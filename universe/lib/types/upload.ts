// Типы для функционала загрузки и конвертации файлов

export type FileType = 'RVT' | 'IFC' | 'CSV' | 'OTHER'

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled'

export type ConversionType = 'RVT_TO_IFC' | 'IFC_TO_CSV' | 'RVT_TO_CSV'

export type ConversionStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

// Загруженный файл
export interface FileUpload {
  id: string
  userId: string
  projectId: string
  versionId: string
  originalFilename: string
  fileType: FileType
  fileSize: number
  mimeType?: string
  storagePath: string
  storageBucket: string
  uploadStatus: UploadStatus
  errorMessage?: string
  modelId?: string
  uploadedAt: string
  completedAt?: string
}

// Задача конвертации
export interface ConversionJob {
  id: string
  fileUploadId: string
  userId: string
  conversionType: ConversionType
  status: ConversionStatus
  priority: number
  progress: number // 0-100
  inputFileId: string
  outputFileId?: string
  exportSettingsId?: string
  startedAt?: string
  completedAt?: string
  durationSeconds?: number
  errorMessage?: string
  errorStack?: string
  parentJobId?: string
  nextJobId?: string
  currentStep?: string
  currentStepCode?: string
}

// Настройки экспорта
export interface ExportSettings {
  id: string
  userId: string
  name: string
  isDefault: boolean
  settings: ExportSettingsConfig
  createdAt: string
  updatedAt: string
}

// Конфигурация настроек экспорта (соответствует ExportSettings.cs)
export interface ExportSettingsConfig {
  // File / Format
  fileVersion?: 'ifc2x3' | 'ifc4' | 'ifc4rv'
  fileType?: 'IFC'
  
  // File Header
  fhFileDesc?: string
  fhFileName?: string
  fhAuthName?: string
  fhAuthEmail?: string
  fhOrganiz?: string
  fhAuthoriz?: string
  fhAppName?: string
  fhVersion?: string
  
  // Visibility / View
  visibleOnly?: boolean
  filterViewId?: string
  roomsIn3D?: boolean
  twoDPlanViewEl?: boolean
  twoDRoomBound?: boolean
  linkedAsSeparate?: boolean
  
  // LOD / Tessellation
  levelOfDetail?: 'low' | 'medium' | 'high'
  clod_MaxNumGridLines?: number
  clod_MaxFacetEdgeLength?: number
  clod_NormalTolerance?: number
  clod_SurfaceTolerance?: number
  clod_GridAspectRatio?: number
  clod_BetweenKnots?: number
  clod_PointsPerEdge?: number
  clod_RecalculateSurfaceTolerance?: boolean
  clod_FastMode?: boolean
  clod_UseTesselation?: boolean
  clod_Curve3dPointsEpsilon?: number
  
  // Property Sets
  propertySets?: {
    bimRvPropSets?: boolean
    ignoreIfcPg?: boolean
    ifcCommonPropSets?: boolean
    baseQuantities?: boolean
    schedules?: boolean
    schedFilter?: boolean
    materialPropSets?: boolean
    userDefPSets?: boolean
    paramMapTable?: boolean
  }
  
  // Advanced Options
  advancedOptions?: {
    partsAsBuildElem?: boolean
    solidModel?: boolean
    useActiveView?: boolean
    twoDRoomBound?: boolean
    incSiteElev?: boolean
    storeGuidAsParam?: boolean
    exportBoundBox?: boolean
    keepTesGeomAsTriangl?: boolean
    coplanarFacesToExtrusion?: boolean
    disableAnalyzers?: boolean
    systemMaterialIsMain?: boolean
    exportGeometryOnly?: boolean
  }
  
  // Geometry / Origin
  projOrigin?: 'CurrentShared'
  spaceBound?: 'None'
  split?: boolean
  steel?: boolean
  phaseToExport?: number
  
  // Naming / Types
  useFamTypeRef?: boolean
  useVisibleNameAsEntityName?: boolean
  useTypeNameOnlyForIfcType?: boolean
  
  // Company / Project / Site
  companyType?: string
  companyName?: string
  streetAddr?: string
  city?: string
  state?: string
  postCode?: string
  country?: string
  companyPhone?: string
  companyEmail?: string
  buildName?: string
  buildType?: string
  buildDesc?: string
  projName?: string
  projDesc?: string
  projPhase?: string
  siteLoc?: string
  siteDesc?: string
  
  // Facility
  facilityType?: 'Building'
  facilityPredefinedType?: string
}

// Метаданные файла
export interface FileMetadata {
  id: string
  fileUploadId: string
  rowCount?: number
  columnCount?: number
  columnNames?: string[]
  ifcVersion?: string
  ifcSchema?: string
  elementCount?: number
  fileHash?: string
  processingTimeSeconds?: number
  extraMetadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Лог конвертации
export interface ConversionLog {
  id: string
  conversionJobId: string
  logLevel: LogLevel
  message: string
  metadata?: Record<string, any>
  createdAt: string
}

// Запрос на загрузку файла
export interface UploadFileRequest {
  projectId: string
  versionId: string
  projectName?: string  // Название проекта для пути в хранилище
  versionName?: string  // Название версии для пути в хранилище
  file: File
  exportSettingsId?: string
  autoConvert?: boolean // автоматически начать конвертацию после загрузки
  convertToIFC?: boolean // конвертировать RVT в IFC для 3D визуализации
}

// Ответ на загрузку файла
export interface UploadFileResponse {
  fileUpload: FileUpload
  conversionJob?: ConversionJob // если autoConvert = true
}

// Статус загрузки (для реального времени)
export interface UploadProgress {
  fileUploadId: string
  uploadStatus: UploadStatus
  uploadProgress: number // 0-100
  conversionStatus?: ConversionStatus
  conversionProgress?: number // 0-100
  currentStep?: string
  currentStepCode?: string
  errorMessage?: string
}

export interface ProjectConversionStatus {
  job: ConversionJob
  file: {
    id: string
    projectId: string
    versionId: string
    originalFilename: string
    fileType: FileType
    fileSize: number
    uploadedAt?: string
  }
  currentStep?: string
  currentStepCode?: string
}

// Статус очереди конвертаций
export interface QueueStatus {
  queuedCount: number
  processingCount: number
  windowsServerBusy: boolean | null
  availableSlots: number | null
  totalSlots: number | null
  nextJobId: string | null
  hasQueue: boolean
}

// Стандартные настройки экспорта (по умолчанию)
export const DEFAULT_EXPORT_SETTINGS: ExportSettingsConfig = {
  fileVersion: 'ifc4rv',
  visibleOnly: true,
  levelOfDetail: 'low',
  clod_FastMode: true,
  clod_RecalculateSurfaceTolerance: true,
  roomsIn3D: false,
  twoDPlanViewEl: false,
  propertySets: {
    bimRvPropSets: true,        // Экспорт параметров Revit как IFC property sets
    baseQuantities: true,       // Экспорт базовых количеств (QTO)
    materialPropSets: true,     // Экспорт property sets материалов
    ignoreIfcPg: true,          // Игнорирование группы свойств IFC
    ifcCommonPropSets: true,    // Экспорт общих IFC property sets (ВКЛЮЧЕНО для всех property sets)
    schedules: true,            // Экспорт спецификаций (ВКЛЮЧЕНО для всех property sets)
    schedFilter: false,         // Фильтр спецификаций (по умолчанию выключен)
    userDefPSets: true,         // Экспорт пользовательских property sets (ВКЛЮЧЕНО для всех property sets)
    paramMapTable: true,        // Использование таблицы маппинга параметров (ВКЛЮЧЕНО для всех property sets)
  },
  advancedOptions: {
    coplanarFacesToExtrusion: true,
    systemMaterialIsMain: true,
  },
  linkedAsSeparate: false,
}

