"""
API endpoints для управления проектами
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from app.core.database import get_db
from app.core.universe_auth import get_current_active_user
from app.models.project import Project, ProjectVersion
from app.models.upload import FileUpload, CSVDataRow, ConversionJob, ConversionLog
from app.models.universe_user import UniverseUser
from app.core.storage import storage_service
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectVersionCreate,
    ProjectVersionUpdate,
    ProjectVersionResponse,
    generate_slug,
)
from app.utils.identifiers import resolve_project_by_identifier, resolve_version_by_identifier

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    search: Optional[str] = Query(None, description="Поиск по названию проекта"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Получить список проектов пользователя
    
    Args:
        search: Поиск по названию проекта
        limit: Максимальное количество проектов
        offset: Смещение для пагинации
        db: Сессия БД
        postgres_user_id: PostgreSQL user_id из JWT токена
    """
    query = db.query(Project).filter(Project.created_by == str(current_user.id))
    
    if search:
        query = query.filter(or_(
            Project.name.ilike(f"%{search}%"),
            Project.description.ilike(f"%{search}%"),
        ))
    
    projects = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Создать новый проект
    
    Args:
        project_data: Данные проекта
        db: Сессия БД
        postgres_user_id: PostgreSQL user_id из JWT токена
    """
    # Генерируем slug если не указан
    slug = project_data.slug or generate_slug(project_data.name)
    
    # Проверяем уникальность slug
    existing_project = db.query(Project).filter(Project.slug == slug).first()
    if existing_project:
        raise HTTPException(status_code=400, detail=f"Проект с slug '{slug}' уже существует")
    
    # Создаем проект
    project = Project(
        name=project_data.name,
        slug=slug,
        description=project_data.description,
        created_by=str(current_user.id),
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    """
    Получить проект по ID
    
    Args:
        project_id: ID проекта
        db: Сессия БД
    """
    project = resolve_project_by_identifier(project_id, db)
    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Обновить проект
    
    Args:
        project_id: ID проекта
        project_data: Данные для обновления
        db: Сессия БД
        postgres_user_id: PostgreSQL user_id из JWT токена
    """
    project = resolve_project_by_identifier(project_id, db)
    
    # Проверка прав доступа
    if str(project.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Нет доступа к этому проекту")
    
    # Обновляем поля
    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.slug is not None:
        # Проверяем уникальность нового slug
        if project_data.slug != project.slug:
            existing = db.query(Project).filter(Project.slug == project_data.slug).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Проект с slug '{project_data.slug}' уже существует")
        project.slug = project_data.slug
    
    db.commit()
    db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Удалить проект и все связанные данные
    
    Args:
        project_id: ID проекта
        db: Сессия БД
        current_user: Текущий пользователь
    """
    project = resolve_project_by_identifier(project_id, db)
    
    # Проверка прав доступа
    if str(project.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Нет доступа к этому проекту")
    
    # 1. Находим все file_uploads проекта (через все версии и напрямую)
    # Сначала получаем все версии проекта
    versions = db.query(ProjectVersion).filter(
        ProjectVersion.project_id == project.id
    ).all()
    version_ids = [version.id for version in versions]
    
    # Находим все file_uploads проекта (через версии и напрямую)
    if version_ids:
        file_uploads = db.query(FileUpload).filter(
            or_(
                FileUpload.project_id == project.id,
                FileUpload.version_id.in_(version_ids)
            )
        ).all()
    else:
        file_uploads = db.query(FileUpload).filter(
            FileUpload.project_id == project.id
        ).all()
    
    file_upload_ids = [file_upload.id for file_upload in file_uploads]
    
    # 2. Удаляем задачи конвертации, связанные с этими файлами
    deleted_logs = 0
    deleted_jobs = 0
    if file_upload_ids:
        # Находим все job_ids, связанные с этими файлами
        job_ids = [
            job_id for (job_id,) in db.query(ConversionJob.id).filter(
                or_(
                    ConversionJob.file_upload_id.in_(file_upload_ids),
                    ConversionJob.input_file_id.in_(file_upload_ids),
                    ConversionJob.output_file_id.in_(file_upload_ids)
                )
            ).all()
        ]
        
        # Также находим jobs, связанные через parent_job_id или next_job_id
        if job_ids:
            related_job_ids = [
                job_id for (job_id,) in db.query(ConversionJob.id).filter(
                    or_(
                        ConversionJob.parent_job_id.in_(job_ids),
                        ConversionJob.next_job_id.in_(job_ids)
                    )
                ).all()
            ]
            job_ids.extend(related_job_ids)
            job_ids = list(set(job_ids))  # Убираем дубликаты
        
        if job_ids:
            # Сначала удаляем все логи, связанные с этими jobs
            deleted_logs = db.query(ConversionLog).filter(
                ConversionLog.conversion_job_id.in_(job_ids)
            ).delete(synchronize_session=False)
            
            # Делаем flush, чтобы изменения были видны
            db.flush()
            
            # Затем удаляем сами jobs
            deleted_jobs = db.query(ConversionJob).filter(
                ConversionJob.id.in_(job_ids)
            ).delete(synchronize_session=False)
    
    # 3. Удаляем физические файлы из хранилища и записи FileUpload
    for file_upload in file_uploads:
        # Удаляем физический файл из хранилища
        try:
            if file_upload.storage_path:
                storage_service.delete_file(file_upload.storage_path)
        except Exception as e:
            print(f"Error deleting file from storage {file_upload.id}: {e}")
        
        # Удаляем запись о файле (каскадно удалит метаданные)
        db.delete(file_upload)
    
    # 4. Удаляем строки данных (CSVDataRow) проекта
    db.query(CSVDataRow).filter(
        CSVDataRow.project_id == project.id
    ).delete(synchronize_session=False)
    
    # 5. Удаляем версии проекта (каскадно удалит связанные данные через relationship)
    for version in versions:
        db.delete(version)
    
    # 6. Удаляем сам проект
    db.delete(project)
    db.commit()
    
    return None


# Project Versions endpoints
@router.get("/{project_id}/versions", response_model=List[ProjectVersionResponse])
async def list_project_versions(
    project_id: str,
    db: Session = Depends(get_db),
):
    """
    Получить список версий проекта
    
    Args:
        project_id: ID проекта
        db: Сессия БД
    """
    # Проверяем существование проекта
    project = resolve_project_by_identifier(project_id, db)
    
    versions = db.query(ProjectVersion).filter(
        ProjectVersion.project_id == project.id
    ).order_by(ProjectVersion.created_at.desc()).all()
    
    return [ProjectVersionResponse.model_validate(v) for v in versions]


@router.post("/{project_id}/versions", response_model=ProjectVersionResponse, status_code=201)
async def create_project_version(
    project_id: str,
    version_data: ProjectVersionCreate,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Создать новую версию проекта
    
    Args:
        project_id: ID проекта
        version_data: Данные версии
        db: Сессия БД
        postgres_user_id: PostgreSQL user_id из JWT токена
    """
    # Проверяем существование проекта и права доступа
    project = resolve_project_by_identifier(project_id, db)
    
    if str(project.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Нет доступа к этому проекту")
    
    # Генерируем slug если не указан
    slug = version_data.slug or generate_slug(version_data.name)
    
    # Проверяем уникальность slug в рамках проекта
    existing_version = db.query(ProjectVersion).filter(
        ProjectVersion.project_id == project.id,
        ProjectVersion.slug == slug
    ).first()
    if existing_version:
        raise HTTPException(status_code=400, detail=f"Версия с slug '{slug}' уже существует в этом проекте")
    
    # Создаем версию
    version = ProjectVersion(
        project_id=project.id,
        name=version_data.name,
        slug=slug,
        description=version_data.description,
        created_by=str(current_user.id),
    )
    
    db.add(version)
    db.commit()
    db.refresh(version)
    
    return ProjectVersionResponse.model_validate(version)


@router.get("/{project_id}/versions/{version_id}", response_model=ProjectVersionResponse)
async def get_project_version(
    project_id: str,
    version_id: str,
    db: Session = Depends(get_db),
):
    """
    Получить версию проекта по ID
    
    Args:
        project_id: ID проекта
        version_id: ID версии
        db: Сессия БД
    """
    project = resolve_project_by_identifier(project_id, db)
    version = resolve_version_by_identifier(version_id, db, project.id)
    return ProjectVersionResponse.model_validate(version)


@router.put("/{project_id}/versions/{version_id}", response_model=ProjectVersionResponse)
async def update_project_version(
    project_id: str,
    version_id: str,
    version_data: ProjectVersionUpdate,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Обновить версию проекта
    
    Args:
        project_id: ID проекта
        version_id: ID версии
        version_data: Данные для обновления
        db: Сессия БД
        postgres_user_id: PostgreSQL user_id из JWT токена
    """
    project = resolve_project_by_identifier(project_id, db)
    version = resolve_version_by_identifier(version_id, db, project.id)
    
    # Проверка прав доступа
    if str(version.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Нет доступа к этой версии проекта")
    
    # Обновляем поля
    if version_data.name is not None:
        version.name = version_data.name
    if version_data.description is not None:
        version.description = version_data.description
    if version_data.slug is not None:
        # Проверяем уникальность нового slug в рамках проекта
        if version_data.slug != version.slug:
            existing = db.query(ProjectVersion).filter(
                ProjectVersion.project_id == project.id,
                ProjectVersion.slug == version_data.slug
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Версия с slug '{version_data.slug}' уже существует в этом проекте")
        version.slug = version_data.slug
    
    db.commit()
    db.refresh(version)
    
    return ProjectVersionResponse.model_validate(version)


@router.delete("/{project_id}/versions/{version_id}", status_code=204)
async def delete_project_version(
    project_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Удалить версию проекта
    
    Args:
        project_id: ID проекта
        version_id: ID версии
        db: Сессия БД
        postgres_user_id: PostgreSQL user_id из JWT токена
    """
    from fastapi.responses import Response
    
    project = resolve_project_by_identifier(project_id, db)
    version = resolve_version_by_identifier(version_id, db, project.id)
    
    # Проверка прав доступа
    if str(version.created_by) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Нет доступа к этой версии проекта")
    
    db.delete(version)
    db.commit()
    
    # Явно возвращаем Response со статусом 204 без тела
    return Response(status_code=204)


@router.delete("/{project_id}/versions/{version_id}/data", status_code=200)
async def delete_project_version_data(
    project_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: UniverseUser = Depends(get_current_active_user),
):
    """
    Удалить все данные версии проекта (IFC, CSV файлы и записи данных)
    """
    project = resolve_project_by_identifier(project_id, db)
    version = resolve_version_by_identifier(version_id, db, project.id)

    # Проверка прав доступа
    if str(version.created_by) != str(current_user.id):
         raise HTTPException(status_code=403, detail="Нет доступа к этой версии проекта")
    
    # 1. Находим и удаляем файлы (FileUpload)
    file_uploads = db.query(FileUpload).filter(
        FileUpload.version_id == version.id
    ).all()

    file_upload_ids = [file_upload.id for file_upload in file_uploads]

    # Удаляем задачи конвертации, связанные с этими файлами (в любом поле)
    deleted_logs = 0
    deleted_jobs = 0
    if file_upload_ids:
        # Находим все job_ids, связанные с этими файлами
        job_ids = [
            job_id for (job_id,) in db.query(ConversionJob.id).filter(
                or_(
                    ConversionJob.file_upload_id.in_(file_upload_ids),
                    ConversionJob.input_file_id.in_(file_upload_ids),
                    ConversionJob.output_file_id.in_(file_upload_ids)
                )
            ).all()
        ]
        
        # Также находим jobs, связанные через parent_job_id или next_job_id
        if job_ids:
            related_job_ids = [
                job_id for (job_id,) in db.query(ConversionJob.id).filter(
                    or_(
                        ConversionJob.parent_job_id.in_(job_ids),
                        ConversionJob.next_job_id.in_(job_ids)
                    )
                ).all()
            ]
            job_ids.extend(related_job_ids)
            job_ids = list(set(job_ids))  # Убираем дубликаты
        
        if job_ids:
            # Сначала удаляем все логи, связанные с этими jobs
            deleted_logs = db.query(ConversionLog).filter(
                ConversionLog.conversion_job_id.in_(job_ids)
            ).delete(synchronize_session=False)
            
            # Делаем flush, чтобы изменения были видны
            db.flush()
            
            # Затем удаляем сами jobs
            deleted_jobs = db.query(ConversionJob).filter(
                ConversionJob.id.in_(job_ids)
            ).delete(synchronize_session=False)
    
    deleted_files_count = 0
    deleted_ifcs = 0
    deleted_csvs = 0
    
    for file_upload in file_uploads:
        # Удаляем физический файл из хранилища
        try:
            if file_upload.storage_path:
                storage_service.delete_file(file_upload.storage_path)
        except Exception as e:
            print(f"Error deleting file from storage {file_upload.id}: {e}")
        
        # Считаем статистику
        file_type = str(file_upload.file_type).upper()
        filename = str(file_upload.original_filename).lower()
        
        if file_type == 'IFC' or filename.endswith('.ifc') or filename.endswith('.rvt'):
            deleted_ifcs += 1
        elif file_type == 'CSV' or filename.endswith('.csv'):
            deleted_csvs += 1
            
        # Удаляем запись о файле (каскадно удалит метаданные и задачи)
        db.delete(file_upload)
        deleted_files_count += 1

    # 2. Удаляем строки данных (CSVDataRow)
    # Удаляем напрямую по version_id для надежности
    deleted_rows = db.query(CSVDataRow).filter(
        CSVDataRow.version_id == version.id
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Удалено {deleted_files_count} файлов и {deleted_rows} строк данных",
        "deleted_files": deleted_files_count,
        "deleted_ifcs": deleted_ifcs,
        "deleted_csv": deleted_csvs,
        "deleted_rows": deleted_rows,
        "deleted_jobs": deleted_jobs,
        "deleted_logs": deleted_logs,
    }



