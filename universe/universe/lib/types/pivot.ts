/**
 * Типы для Pivot-аналитики
 */

export type AggregationFunction = "SUM" | "COUNT" | "AVG" | "MIN" | "MAX" | "COUNT_DISTINCT";

export interface PivotField {
  field: string;
  displayName?: string;
}

export interface PivotAggregation {
  field: string;
  function: AggregationFunction;
  displayName?: string;
}

export interface PivotRequest {
  userId?: string;
  projectId?: string;
  versionId?: string;
  fileUploadId?: string;
  rows: string[];
  columns: string[];
  values: PivotAggregation[];
  selectedParameters?: string[]; // Выбранные параметры для unpivot (обратного pivot)
  filters?: Record<string, any>;
  limit?: number;
}

export interface PivotCell {
  rowKey: string;
  columnKey: string;
  values: Record<string, any>;
}

export interface PivotResponse {
  rows: string[];
  columns: string[];
  cells: PivotCell[];
  aggregations: PivotAggregation[];
  totalRows: number;
}

export interface AvailableField {
  field: string;
  displayName: string;
  type: string;
  sampleValues: string[];
  uniqueCount: number;
}

export interface AvailableFieldsResponse {
  fields: AvailableField[];
}

/**
 * Сохраненный pivot-отчет (вкладка)
 */
export interface PivotReport {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  versionId: string;
  userId?: string;
  // Настройки pivot-таблицы
  rows: string[];
  columns: string[];
  values: PivotAggregation[];
  selectedParameters?: string[]; // Выбранные параметры для unpivot
  filters?: Record<string, any>;
  // Результаты pivot-таблицы
  pivotData?: PivotResponse;
  // Метаданные
  createdAt: string;
  updatedAt: string;
}

export interface CreatePivotReportRequest {
  name: string;
  description?: string;
  projectId: string;
  versionId: string;
  rows: string[];
  columns: string[];
  values: PivotAggregation[];
  selectedParameters?: string[];
  filters?: Record<string, any>;
  pivotData?: PivotResponse;
}

export interface UpdatePivotReportRequest {
  name?: string;
  description?: string;
  rows?: string[];
  columns?: string[];
  values?: PivotAggregation[];
  selectedParameters?: string[];
  filters?: Record<string, any>;
  pivotData?: PivotResponse;
}

