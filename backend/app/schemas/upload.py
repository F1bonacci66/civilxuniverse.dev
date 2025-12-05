"""
Pydantic схемы для валидации данных API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# FileUpload Schemas
class FileUploadBase(BaseModel):
    project_id: UUID
    version_id: UUID
    original_filename: str
    file_type: str
    file_size: int


class FileUploadCreate(FileUploadBase):
    storage_path: str
    storage_bucket: str = "civilx-universe"
    mime_type: Optional[str] = None


class FileUploadResponse(FileUploadBase):
    id: UUID
    user_id: UUID
    storage_path: str
    storage_bucket: str
    mime_type: Optional[str]
    upload_status: str
    error_message: Optional[str]
    model_id: Optional[UUID]
    uploaded_at: datetime
    completed_at: Optional[datetime]
    
    model_config = {"from_attributes": True, "protected_namespaces": ()}


# ConversionJob Schemas
class ConversionJobBase(BaseModel):
    file_upload_id: UUID
    conversion_type: str
    priority: int = 0


class ConversionJobCreate(ConversionJobBase):
    export_settings_id: Optional[UUID] = None
    input_file_id: UUID
    parent_job_id: Optional[UUID] = None


class ConversionJobResponse(ConversionJobBase):
    id: UUID
    user_id: UUID
    status: str
    progress: int
    input_file_id: UUID
    output_file_id: Optional[UUID]
    export_settings_id: Optional[UUID]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]
    error_message: Optional[str]
    error_stack: Optional[str]
    parent_job_id: Optional[UUID]
    next_job_id: Optional[UUID]
    
    class Config:
        from_attributes = True


# UploadProgress Schema
class UploadProgressResponse(BaseModel):
    file_upload_id: UUID
    upload_status: str
    upload_progress: int
    conversion_status: Optional[str] = None
    conversion_progress: Optional[int] = None
    current_step: Optional[str] = None
    error_message: Optional[str] = None


# ExportSettings Schemas
class ExportSettingsConfig(BaseModel):
    """Конфигурация настроек экспорта"""
    file_version: Optional[str] = None
    visible_only: Optional[bool] = True
    level_of_detail: Optional[str] = "low"
    clod_fast_mode: Optional[bool] = True
    property_sets: Optional[Dict[str, Any]] = None
    advanced_options: Optional[Dict[str, Any]] = None
    # ... другие настройки


class ExportSettingsCreate(BaseModel):
    user_id: UUID
    name: str
    is_default: bool = False
    settings: Dict[str, Any]


class ExportSettingsResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    is_default: bool
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# FileMetadata Schema
class FileMetadataResponse(BaseModel):
    id: UUID
    file_upload_id: UUID
    row_count: Optional[int]
    column_count: Optional[int]
    column_names: Optional[List[str]]
    ifc_version: Optional[str]
    ifc_schema: Optional[str]
    element_count: Optional[int]
    file_hash: Optional[str]
    processing_time_seconds: Optional[int]
    extra_metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Request/Response для загрузки файла
class UploadFileResponse(BaseModel):
    fileUpload: FileUploadResponse = Field(alias="file_upload")
    conversionJob: Optional[ConversionJobResponse] = Field(default=None, alias="conversion_job")
    
    model_config = {"from_attributes": True, "populate_by_name": True}


# Request для запуска конвертации
class StartConversionRequest(BaseModel):
    file_upload_id: UUID
    conversion_type: str
    export_settings_id: Optional[UUID] = None

