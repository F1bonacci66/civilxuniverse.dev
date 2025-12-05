"""
SQLAlchemy модели для проектов и версий проектов
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, BigInteger, Sequence
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base
from app.models.upload import GUID

# Используем GUID для совместимости
UUID_Type = GUID

project_short_id_seq = Sequence("projects_short_id_seq")
project_version_short_id_seq = Sequence("project_versions_short_id_seq")


class Project(Base):
    """Модель проекта"""
    __tablename__ = "projects"
    
    id = Column(UUID_Type(), primary_key=True, default=lambda: str(uuid.uuid4()))
    short_id = Column(
        BigInteger,
        project_short_id_seq,
        server_default=project_short_id_seq.next_value(),
        nullable=False,
        unique=True,
        index=True,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    # created_by временно без ForeignKey, так как таблица users еще не создана
    # created_by = Column(UUID_Type(), ForeignKey("users.id", name="fk_projects_created_by"), nullable=False, index=True)
    created_by = Column(UUID_Type(), nullable=False, index=True)
    # company_id временно отключен, так как таблица companies еще не создана
    # company_id = Column(UUID_Type(), ForeignKey("companies.id", name="fk_projects_company_id"), nullable=True, index=True)
    company_id = Column(UUID_Type(), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships (lazy loading для избежания проблем при сериализации)
    versions = relationship("ProjectVersion", back_populates="project", cascade="all, delete-orphan", lazy="select")
    file_uploads = relationship("FileUpload", back_populates="project", lazy="select")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}')>"


class ProjectVersion(Base):
    """Модель версии проекта"""
    __tablename__ = "project_versions"
    
    id = Column(UUID_Type(), primary_key=True, default=lambda: str(uuid.uuid4()))
    short_id = Column(
        BigInteger,
        project_version_short_id_seq,
        server_default=project_version_short_id_seq.next_value(),
        nullable=False,
        unique=True,
        index=True,
    )
    project_id = Column(UUID_Type(), ForeignKey("projects.id", name="fk_project_versions_project"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # created_by временно без ForeignKey, так как таблица users еще не создана
    # created_by = Column(UUID_Type(), ForeignKey("users.id", name="fk_project_versions_created_by"), nullable=False, index=True)
    created_by = Column(UUID_Type(), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Уникальность slug в рамках проекта
    __table_args__ = (
        UniqueConstraint('project_id', 'slug', name='unique_project_version_slug'),
    )
    
    # Relationships (lazy loading для избежания проблем при сериализации)
    project = relationship("Project", back_populates="versions", lazy="select")
    file_uploads = relationship("FileUpload", back_populates="version", lazy="select")
    
    def __repr__(self):
        return f"<ProjectVersion(id={self.id}, name='{self.name}', project_id={self.project_id})>"

