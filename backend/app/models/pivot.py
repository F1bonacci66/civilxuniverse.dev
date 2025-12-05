"""
SQLAlchemy модели для Pivot-аналитики
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base
from app.models.upload import GUID

# Используем GUID для совместимости
UUID_Type = GUID


class PivotReport(Base):
    """Модель сохраненного pivot-отчета"""
    __tablename__ = "pivot_reports"
    
    id = Column(UUID_Type(), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Связи с проектом и версией
    project_id = Column(UUID_Type(), ForeignKey("projects.id", name="fk_pivot_reports_project"), nullable=False, index=True)
    version_id = Column(UUID_Type(), ForeignKey("project_versions.id", name="fk_pivot_reports_version"), nullable=False, index=True)
    user_id = Column(UUID_Type(), nullable=True, index=True)  # TODO: добавить FK когда будет таблица users
    
    # Настройки pivot-таблицы (JSON - совместим с PostgreSQL и SQLite)
    rows = Column(JSON, nullable=False, default=list)  # Список полей для строк
    columns = Column(JSON, nullable=False, default=list)  # Список полей для колонок
    values = Column(JSON, nullable=False, default=list)  # Список агрегаций
    filters = Column(JSON, nullable=True)  # Дополнительные фильтры
    pivot_data = Column(JSON, nullable=True)  # Результаты pivot-таблицы (PivotResponse)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", foreign_keys=[project_id], lazy="select")
    version = relationship("ProjectVersion", foreign_keys=[version_id], lazy="select")
    
    # Индексы для быстрого поиска
    __table_args__ = (
        Index('idx_pivot_reports_project_version', 'project_id', 'version_id'),
        Index('idx_pivot_reports_user_id', 'user_id'),
    )
    
    def __repr__(self):
        return f"<PivotReport(id={self.id}, name='{self.name}')>"

