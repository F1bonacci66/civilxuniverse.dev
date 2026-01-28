/**
 * API клиент для Pivot-аналитики
 */

import type {
  PivotRequest,
  PivotResponse,
  AvailableFieldsResponse,
  PivotReport,
  CreatePivotReportRequest,
  UpdatePivotReportRequest,
} from "@/lib/types/pivot";

// API базовый URL (должен включать /api/datalab)
// Если API URL указывает на localhost, используем относительный путь для проксирования через Next.js
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/datalab'
const API_BASE_URL = rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1') 
  ? '/api/datalab'  // Используем относительный путь для проксирования
  : rawApiUrl       // Используем полный URL для production

/**
 * Преобразует PivotResponse из snake_case (бэкенд) в camelCase (фронтенд)
 */
function transformPivotResponse(data: any): PivotResponse {
  if (!data) return null as any;
  
  const transformed = {
    rows: data.rows || [],
    columns: data.columns || [],
    cells: (data.cells || []).map((cell: any) => ({
      rowKey: cell.row_key || cell.rowKey,
      columnKey: cell.column_key || cell.columnKey,
      values: cell.values || {}
    })),
    aggregations: (data.aggregations || []).map((agg: any) => ({
      field: agg.field,
      function: agg.function,
      displayName: agg.display_name || agg.displayName
    })),
    totalRows: data.total_rows || data.totalRows || 0,
    rowsFields: data.rows_fields || data.rowsFields,
    columnsFields: data.columns_fields || data.columnsFields
  };
  
  // Отладочное логирование
  console.log('🔄 transformPivotResponse:', {
    rawData: {
      rows_fields: data.rows_fields,
      rowsFields: data.rowsFields,
      columns_fields: data.columns_fields,
      columnsFields: data.columnsFields,
    },
    transformed: {
      rowsFields: transformed.rowsFields,
      columnsFields: transformed.columnsFields,
      rowsCount: transformed.rows.length,
      sampleRows: transformed.rows.slice(0, 3)
    }
  });
  
  return transformed;
}

/**
 * Создать pivot-таблицу
 */
export async function createPivotTable(
  request: PivotRequest
): Promise<PivotResponse> {
  const url = `${API_BASE_URL}/pivot`;
  
  // Преобразуем camelCase в snake_case для бэкенда
  const backendRequest: any = {
    user_id: request.userId,
    project_id: request.projectId,
    version_id: request.versionId,
    file_upload_id: request.fileUploadId,
    rows: request.rows,
    columns: request.columns,
    values: request.values,
    selected_parameters: request.selectedParameters,
    filters: request.filters,
    limit: request.limit,
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backendRequest),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  // Отладочное логирование сырого ответа от бэкенда
  console.log('📡 Сырой ответ от бэкенда (createPivotTable):', {
    hasRowsFields: 'rows_fields' in data,
    hasRowsFieldsCamel: 'rowsFields' in data,
    rowsFields: data.rows_fields || data.rowsFields,
    hasColumnsFields: 'columns_fields' in data,
    hasColumnsFieldsCamel: 'columnsFields' in data,
    columnsFields: data.columns_fields || data.columnsFields,
    rowsCount: data.rows?.length,
    columnsCount: data.columns?.length,
    fullDataKeys: Object.keys(data)
  });
  
  // Преобразуем snake_case в camelCase для ответа
  const transformed = transformPivotResponse(data);
  
  const transformedAny = transformed as any
  console.log('📡 Преобразованный ответ (createPivotTable):', {
    hasRowsFields: 'rowsFields' in transformedAny,
    rowsFields: transformedAny.rowsFields,
    hasColumnsFields: 'columnsFields' in transformedAny,
    columnsFields: transformedAny.columnsFields
  });
  
  return transformed;
}

/**
 * Получить уникальные значения для поля после unpivot
 * 
 * @param params.projectId - ID проекта
 * @param params.versionId - ID версии
 * @param params.field - Поле для получения значений
 * @param params.selectedParameters - Выбранные параметры для unpivot
 * @param params.filters - Текущие фильтры для каскадной фильтрации (исключая поле field)
 */
export async function getFilterValues(params: {
  projectId: string;
  versionId: string;
  field: string;
  selectedParameters?: string[];
  filters?: Record<string, string[]>;
}): Promise<string[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("project_id", params.projectId);
  queryParams.append("version_id", params.versionId);
  queryParams.append("field", params.field);
  if (params.selectedParameters && params.selectedParameters.length > 0) {
    params.selectedParameters.forEach(param => {
      queryParams.append("selected_parameters", param);
    });
  }
  
  // Передаем фильтры как JSON строку (исключая текущее поле)
  if (params.filters) {
    const filtersWithoutCurrentField = { ...params.filters };
    // Удаляем фильтр для текущего поля, чтобы избежать циклической зависимости
    delete filtersWithoutCurrentField[params.field];
    // Передаем только если есть другие фильтры
    if (Object.keys(filtersWithoutCurrentField).length > 0) {
      queryParams.append("filters", JSON.stringify(filtersWithoutCurrentField));
    }
  }

  const url = `${API_BASE_URL}/pivot/filter-values?${queryParams.toString()}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Получить список доступных полей для pivot-таблицы
 */
export async function getAvailableFields(params?: {
  userId?: string;
  projectId?: string;
  versionId?: string;
  fileUploadId?: string;
}): Promise<AvailableFieldsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.userId) queryParams.append("user_id", params.userId);
  if (params?.projectId) queryParams.append("project_id", params.projectId);
  if (params?.versionId) queryParams.append("version_id", params.versionId);
  if (params?.fileUploadId) queryParams.append("file_upload_id", params.fileUploadId);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/pivot/fields${queryString ? `?${queryString}` : ''}`;
  
  console.log('📡 Запрос доступных полей:', url);
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Ошибка запроса полей:', {
      status: response.status,
      statusText: response.statusText,
      url,
      errorText,
    });
    
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.detail || error.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('✅ Получены поля:', data);
  
  // Преобразуем snake_case в camelCase
  return {
    fields: data.fields?.map((field: any) => ({
      field: field.field,
      displayName: field.display_name || field.displayName || field.field,
      type: field.type,
      sampleValues: field.sample_values || field.sampleValues || [],
      uniqueCount: field.unique_count || field.uniqueCount || 0,
    })) || [],
  };
}

/**
 * Функция для выполнения fetch с таймаутом
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Запрос превысил таймаут (${timeoutMs}ms)`)
    }
    throw error
  }
}

/**
 * Получить список сохраненных pivot-отчетов
 */
export async function getPivotReports(
  projectId: string,
  versionId: string
): Promise<PivotReport[]> {
  const url = `${API_BASE_URL}/pivot/reports?project_id=${projectId}&version_id=${versionId}`
  const response = await fetchWithTimeout(url, {}, 30000)

  if (!response.ok) {
    throw new Error(`Failed to fetch pivot reports: ${response.statusText}`)
  }

  const data = await response.json()
  
  // Преобразуем snake_case в camelCase
  return data.map((report: any) => ({
    id: report.id,
    name: report.name,
    description: report.description,
    projectId: report.project_id,
    versionId: report.version_id,
    userId: report.user_id,
    rows: report.rows || [],
    columns: report.columns || [],
    values: report.values || [],
    selectedParameters: report.selected_parameters || [],
    filters: report.filters,
    pivotData: report.pivot_data ? transformPivotResponse(report.pivot_data) : undefined,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  }))
}

/**
 * Получить сохраненный pivot-отчет по ID
 */
export async function getPivotReport(reportId: string): Promise<PivotReport> {
  const url = `${API_BASE_URL}/pivot/reports/${reportId}`
  const response = await fetchWithTimeout(url, {}, 30000)

  if (!response.ok) {
    throw new Error(`Failed to fetch pivot report: ${response.statusText}`)
  }

  const report = await response.json()
  
  return {
    id: report.id,
    name: report.name,
    description: report.description,
    projectId: report.project_id,
    versionId: report.version_id,
    userId: report.user_id,
    rows: report.rows || [],
    columns: report.columns || [],
    values: report.values || [],
    selectedParameters: report.selected_parameters || [],
    filters: report.filters,
    pivotData: report.pivot_data ? transformPivotResponse(report.pivot_data) : undefined,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  }
}

/**
 * Создать новый сохраненный pivot-отчет
 */
export async function createPivotReport(
  request: CreatePivotReportRequest
): Promise<PivotReport> {
  const url = `${API_BASE_URL}/pivot/reports`
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: request.name,
        description: request.description,
        project_id: request.projectId,
        version_id: request.versionId,
        rows: request.rows,
        columns: request.columns,
        values: request.values ? request.values.map(v => ({
          field: v.field,
          function: v.function,
          display_name: v.displayName
        })) : [],
        selected_parameters: request.selectedParameters,
        filters: request.filters,
        pivot_data: request.pivotData ? {
          rows: request.pivotData.rows || [],
          columns: request.pivotData.columns || [],
          cells: (request.pivotData.cells || []).map(cell => ({
            row_key: cell.rowKey,
            column_key: cell.columnKey,
            values: cell.values
          })),
          aggregations: (request.pivotData.aggregations || []).map(agg => ({
            field: agg.field,
            function: agg.function,
            display_name: agg.displayName
          })),
          total_rows: request.pivotData.totalRows || 0,
          rows_fields: (request.pivotData as any).rowsFields,
          columns_fields: (request.pivotData as any).columnsFields
        } : undefined,
      }),
    },
    30000
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `Failed to create pivot report: ${response.statusText}`)
  }

  const report = await response.json()
  
  return {
    id: report.id,
    name: report.name,
    description: report.description,
    projectId: report.project_id,
    versionId: report.version_id,
    userId: report.user_id,
    rows: report.rows || [],
    columns: report.columns || [],
    values: report.values || [],
    selectedParameters: report.selected_parameters || [],
    filters: report.filters,
    pivotData: report.pivot_data ? transformPivotResponse(report.pivot_data) : undefined,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  }
}

/**
 * Обновить сохраненный pivot-отчет
 */
export async function updatePivotReport(
  reportId: string,
  request: UpdatePivotReportRequest
): Promise<PivotReport> {
  const url = `${API_BASE_URL}/pivot/reports/${reportId}`
  const response = await fetchWithTimeout(
    url,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: request.name,
        description: request.description,
        rows: request.rows,
        columns: request.columns,
        values: request.values ? request.values.map(v => ({
          field: v.field,
          function: v.function,
          display_name: v.displayName
        })) : undefined,
        selected_parameters: request.selectedParameters,
        filters: request.filters,
        pivot_data: request.pivotData ? {
          rows: request.pivotData.rows || [],
          columns: request.pivotData.columns || [],
          cells: (request.pivotData.cells || []).map(cell => ({
            row_key: cell.rowKey,
            column_key: cell.columnKey,
            values: cell.values
          })),
          aggregations: (request.pivotData.aggregations || []).map(agg => ({
            field: agg.field,
            function: agg.function,
            display_name: agg.displayName
          })),
          total_rows: request.pivotData.totalRows || 0,
          rows_fields: (request.pivotData as any).rowsFields || undefined,
          columns_fields: (request.pivotData as any).columnsFields || undefined
        } : undefined,
      }),
    },
    30000
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `Failed to update pivot report: ${response.statusText}`)
  }

  const report = await response.json()
  
  return {
    id: report.id,
    name: report.name,
    description: report.description,
    projectId: report.project_id,
    versionId: report.version_id,
    userId: report.user_id,
    rows: report.rows || [],
    columns: report.columns || [],
    values: report.values || [],
    selectedParameters: report.selected_parameters || [],
    filters: report.filters,
    pivotData: report.pivot_data ? transformPivotResponse(report.pivot_data) : undefined,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  }
}

/**
 * Удалить сохраненный pivot-отчет
 */
export async function deletePivotReport(reportId: string): Promise<void> {
  const url = `${API_BASE_URL}/pivot/reports/${reportId}`
  const response = await fetchWithTimeout(
    url,
    {
      method: 'DELETE',
    },
    30000
  )

  if (!response.ok) {
    throw new Error(`Failed to delete pivot report: ${response.statusText}`)
  }
}

