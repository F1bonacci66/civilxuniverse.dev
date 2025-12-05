"""
Вспомогательные функции для работы с идентификаторами проектов и версий.
Позволяют принимать как UUID, так и короткие числовые ID/slug.
"""
from __future__ import annotations

from typing import Optional, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectVersion


def _normalize_identifier(identifier: str) -> str:
    if identifier is None:
        raise HTTPException(status_code=400, detail="Идентификатор не указан")
    normalized = identifier.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Идентификатор не указан")
    return normalized


def resolve_project_by_identifier(identifier: str, db: Session) -> Project:
    """
    Найти проект по UUID, короткому ID или slug.
    """
    normalized = _normalize_identifier(identifier)
    project: Optional[Project] = None

    if normalized.isdigit():
        project = db.query(Project).filter(Project.short_id == int(normalized)).first()

    if not project:
        try:
            project_uuid = UUID(normalized)
            project = db.query(Project).filter(Project.id == project_uuid).first()
        except ValueError:
            project = None

    if not project:
        project = db.query(Project).filter(Project.slug == normalized).first()

    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    return project


def resolve_version_by_identifier(
    identifier: str,
    db: Session,
    project_id: Optional[UUID] = None,
) -> ProjectVersion:
    """
    Найти версию проекта по UUID, короткому ID или slug (в рамках проекта).
    """
    normalized = _normalize_identifier(identifier)
    version: Optional[ProjectVersion] = None

    query = db.query(ProjectVersion)
    if project_id:
        query = query.filter(ProjectVersion.project_id == project_id)

    if normalized.isdigit():
        version = query.filter(ProjectVersion.short_id == int(normalized)).first()

    if not version:
        try:
            version_uuid = UUID(normalized)
            uuid_query = db.query(ProjectVersion).filter(ProjectVersion.id == version_uuid)
            if project_id:
                uuid_query = uuid_query.filter(ProjectVersion.project_id == project_id)
            version = uuid_query.first()
        except ValueError:
            version = None

    if not version and project_id:
        version = (
            db.query(ProjectVersion)
            .filter(ProjectVersion.project_id == project_id, ProjectVersion.slug == normalized)
            .first()
        )

    if not version:
        raise HTTPException(status_code=404, detail="Версия проекта не найдена")

    return version


def resolve_project_uuid(identifier: str, db: Session) -> UUID:
    return resolve_project_by_identifier(identifier, db).id


def resolve_version_uuid(
    identifier: str,
    db: Session,
    project_id: Optional[UUID] = None,
) -> UUID:
    return resolve_version_by_identifier(identifier, db, project_id=project_id).id


def resolve_project_and_version(
    project_identifier: Optional[str],
    version_identifier: Optional[str],
    db: Session,
) -> Tuple[Optional[Project], Optional[ProjectVersion]]:
    """
    Вспомогательная функция для одновременного получения проекта и версии.
    """
    project = resolve_project_by_identifier(project_identifier, db) if project_identifier else None
    version = None

    if version_identifier:
        version = resolve_version_by_identifier(
            version_identifier,
            db,
            project_id=project.id if project else None,
        )
        if not project:
            project = db.query(Project).filter(Project.id == version.project_id).first()

    return project, version



