"""
SQLAlchemy модели для загрузки и конвертации файлов
"""
from sqlalchemy import Column, String, Integer, BigInteger, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR
import uuid
import sys

from app.core.database import Base

# UUID тип, совместимый с PostgreSQL и SQLite
class GUID(TypeDecorator):
    """Platform-independent GUID type."""
    impl = CHAR
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgresUUID())
        else:
            return dialect.type_descriptor(CHAR(36))
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value) if isinstance(value, uuid.UUID) else value
        else:
            # Для SQLite преобразуем в строку
            if isinstance(value, uuid.UUID):
                return str(value)
            elif isinstance(value, str):
                return value
            else:
                return str(uuid.UUID(str(value)))
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            if isinstance(value, uuid.UUID):
                return value
            return uuid.UUID(str(value)) if value else None
        else:
            # Для SQLite преобразуем из строки
            if isinstance(value, uuid.UUID):
                return value
            return uuid.UUID(str(value)) if value else None

# Используем GUID для совместимости с SQLite
UUID = GUID


class FileUpload(Base):
    """Модель загруженного файла"""
    __tablename__ = "file_uploads"
    
    id = Column(UUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUID(), nullable=False, index=True)
    project_id = Column(UUID(), ForeignKey("projects.id", name="fk_file_uploads_project"), nullable=False, index=True)
    version_id = Column(UUID(), ForeignKey("project_versions.id", name="fk_file_uploads_version"), nullable=False, index=True)
    
    # Информация о файле
    original_filename = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)  # RVT, IFC, CSV, OTHER
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100))
    
    # Ссылка на файл в хранилище
    storage_path = Column(Text, nullable=False)
    storage_bucket = Column(String(255), nullable=False, default="civilx-universe")
    
    # Метаданные
    upload_status = Column(String(20), nullable=False, default="pending", index=True)
    error_message = Column(Text)
    
    # Связь с моделью
    model_id = Column(UUID(), nullable=True)
    
    # Временные метки
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships (lazy loading - не загружаются автоматически при сериализации)
    project = relationship("Project", back_populates="file_uploads", lazy="select")
    version = relationship("ProjectVersion", back_populates="file_uploads", lazy="select")
    conversion_jobs = relationship(
        "ConversionJob", 
        foreign_keys="ConversionJob.file_upload_id",
        back_populates="file_upload", 
        cascade="all, delete-orphan"
    )
    file_metadata = relationship("FileMetadata", back_populates="file_upload", uselist=False, cascade="all, delete-orphan")


class ConversionJob(Base):
    """Модель задачи конвертации"""
    __tablename__ = "conversion_jobs"
    
    id = Column(UUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_upload_id = Column(UUID(), ForeignKey("file_uploads.id", name="fk_conversion_jobs_file_upload"), nullable=False, index=True)
    user_id = Column(UUID(), nullable=False, index=True)
    
    # Тип конвертации
    conversion_type = Column(String(20), nullable=False)  # RVT_TO_IFC, IFC_TO_CSV, RVT_TO_CSV
    
    # Статус конвертации
    status = Column(String(20), nullable=False, default="pending", index=True)
    
    # Приоритет
    priority = Column(Integer, default=0)
    
    # Прогресс (0-100)
    progress = Column(Integer, default=0)
    
    # Входные и выходные файлы
    input_file_id = Column(UUID(), ForeignKey("file_uploads.id", name="fk_conversion_jobs_input_file"), nullable=False)
    output_file_id = Column(UUID(), ForeignKey("file_uploads.id", name="fk_conversion_jobs_output_file"), nullable=True)
    
    # Настройки экспорта
    export_settings_id = Column(UUID(), ForeignKey("export_settings.id"), nullable=True)
    
    # Метаданные обработки
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    
    # Ошибки
    error_message = Column(Text)
    error_stack = Column(Text)
    
    # Рабочий процесс
    parent_job_id = Column(UUID(), ForeignKey("conversion_jobs.id"), nullable=True)
    next_job_id = Column(UUID(), ForeignKey("conversion_jobs.id"), nullable=True)
    
    # Relationships
    file_upload = relationship(
        "FileUpload", 
        foreign_keys=[file_upload_id], 
        back_populates="conversion_jobs"
    )
    input_file = relationship(
        "FileUpload", 
        foreign_keys=[input_file_id],
        post_update=True
    )
    output_file = relationship(
        "FileUpload", 
        foreign_keys=[output_file_id],
        post_update=True
    )
    export_settings = relationship("ExportSettings", back_populates="conversion_jobs")
    logs = relationship("ConversionLog", back_populates="conversion_job", cascade="all, delete-orphan")
    parent_job = relationship("ConversionJob", remote_side=[id], foreign_keys=[parent_job_id])
    next_job = relationship("ConversionJob", remote_side=[id], foreign_keys=[next_job_id])


class ConversionLog(Base):
    """Модель лога конвертации"""
    __tablename__ = "conversion_logs"
    
    id = Column(UUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversion_job_id = Column(UUID(), ForeignKey("conversion_jobs.id"), nullable=False, index=True)
    
    log_level = Column(String(10), nullable=False, index=True)  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    message = Column(Text, nullable=False)
    log_metadata = Column("metadata", JSON)  # Используем Column("metadata", ...) чтобы сохранить имя колонки в БД
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    conversion_job = relationship("ConversionJob", back_populates="logs")


class ExportSettings(Base):
    """Модель настроек экспорта"""
    __tablename__ = "export_settings"
    
    id = Column(UUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUID(), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_default = Column(Boolean, default=False)
    
    # Настройки экспорта (JSON)
    settings = Column(JSON, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    conversion_jobs = relationship("ConversionJob", back_populates="export_settings")


class FileMetadata(Base):
    """Модель метаданных файла"""
    __tablename__ = "file_metadata"
    
    id = Column(UUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_upload_id = Column(UUID(), ForeignKey("file_uploads.id"), nullable=False, unique=True, index=True)
    
    # Метаданные CSV файла
    row_count = Column(Integer)
    column_count = Column(Integer)
    column_names = Column(JSON)  # массив названий колонок
    
    # Метаданные IFC/RVT файла
    ifc_version = Column(String(20))
    ifc_schema = Column(String(50))
    element_count = Column(Integer)
    
    # Статистика
    file_hash = Column(String(64), index=True)  # SHA-256
    processing_time_seconds = Column(Integer)
    
    # Дополнительные метаданные
    extra_metadata = Column(JSON)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    file_upload = relationship("FileUpload", back_populates="file_metadata")


class CSVDataRow(Base):
    """Модель строки данных CSV"""
    __tablename__ = "csv_data_rows"
    
    id = Column(UUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_upload_id = Column(UUID(), ForeignKey("file_uploads.id", name="fk_csv_data_file_upload"), nullable=False, index=True)
    
    # ⚠️ КРИТИЧНО для изоляции данных
    # user_id временно без ForeignKey, так как таблица users еще не создана
    # user_id = Column(UUID(), ForeignKey("users.id", name="fk_csv_data_user"), nullable=False, index=True)
    user_id = Column(UUID(), nullable=False, index=True)
    project_id = Column(UUID(), ForeignKey("projects.id", name="fk_csv_data_project"), nullable=False, index=True)
    version_id = Column(UUID(), ForeignKey("project_versions.id", name="fk_csv_data_version"), nullable=False, index=True)
    
    # Номер строки в CSV (1-based, без заголовка)
    row_number = Column(Integer, nullable=False)
    
    # Данные из CSV файла
    model_name = Column(String(255))
    element_id = Column(String(255), index=True)
    category = Column(String(255), index=True)
    parameter_name = Column(String(255), index=True)
    parameter_value = Column(Text)
    
    # Все данные строки в виде JSON для гибкости
    data = Column(JSON)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    file_upload = relationship("FileUpload", foreign_keys=[file_upload_id])
