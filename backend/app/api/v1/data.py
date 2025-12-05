"""
API endpoints для работы с данными CSV
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.upload import FileUpload, CSVDataRow
from app.services.csv_loader import CSVLoaderService
from app.schemas.upload import FileUploadResponse
from app.utils.identifiers import resolve_project_uuid, resolve_version_uuid

router = APIRouter()


@router.post("/upload/{file_upload_id}/load-data")
async def load_csv_data(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Загрузить CSV данные в БД
    
    Args:
        file_upload_id: ID загрузки CSV файла
        
    Returns:
        Результат загрузки с количеством загруженных строк
    """
    # Получаем запись FileUpload
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    if file_upload.file_type != "CSV":
        raise HTTPException(
            status_code=400, 
            detail=f"File type must be CSV, got {file_upload.file_type}"
        )
    
    # Загружаем данные
    csv_loader = CSVLoaderService()
    result = await csv_loader.load_csv_to_db(
        db=db,
        file_upload=file_upload
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to load CSV data")
        )
    
    return result


@router.get("/upload/{file_upload_id}/data/statistics")
async def get_csv_statistics(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Получить статистику по загруженным CSV данным
    
    Returns:
        Статистика по данным
    """
    # Проверяем, что файл существует
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Получаем статистику
    csv_loader = CSVLoaderService()
    stats = csv_loader.get_csv_statistics(db, str(file_upload_id))
    
    return stats


@router.get("/data")
async def get_csv_data(
    file_upload_id: Optional[UUID] = Query(None, description="ID загрузки файла"),
    user_id: Optional[UUID] = Query(None, description="ID пользователя"),
    project_id: Optional[str] = Query(None, description="ID проекта (UUID или короткий ID)"),
    version_id: Optional[str] = Query(None, description="ID версии (UUID или короткий ID)"),
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    parameter_name: Optional[str] = Query(None, description="Фильтр по названию параметра"),
    element_id: Optional[str] = Query(None, description="Фильтр по ID элемента"),
    search: Optional[str] = Query(None, description="Поиск по всем текстовым полям"),
    sort_by: Optional[str] = Query("row_number", description="Поле для сортировки"),
    sort_order: Optional[str] = Query("asc", description="Порядок сортировки: asc или desc"),
    limit: int = Query(100, ge=1, le=1000, description="Лимит записей"),
    offset: int = Query(0, ge=0, description="Смещение"),
    distinct_only: Optional[bool] = Query(False, description="Вернуть только уникальные категории и параметры"),
    db: Session = Depends(get_db),
):
    """
    Получить данные CSV с фильтрацией, сортировкой, поиском и пагинацией
    
    Returns:
        Список записей CSV данных
    """
    from sqlalchemy import or_, asc, desc
    
    # Строим запрос
    query = db.query(CSVDataRow)
    
    # Применяем фильтры
    if file_upload_id:
        query = query.filter(CSVDataRow.file_upload_id == file_upload_id)
    
    if user_id:
        query = query.filter(CSVDataRow.user_id == user_id)
    
    project_uuid = None
    if project_id:
        project_uuid = resolve_project_uuid(project_id, db)
        query = query.filter(CSVDataRow.project_id == project_uuid)
    
    if version_id:
        version_uuid = resolve_version_uuid(version_id, db, project_uuid)
        query = query.filter(CSVDataRow.version_id == version_uuid)
    
    # Сохраняем query до применения фильтров по category и parameter_name
    # (для получения всех уникальных значений при distinct_only)
    base_query_for_distinct = query
    
    if category:
        query = query.filter(CSVDataRow.category == category)
    
    if parameter_name:
        query = query.filter(CSVDataRow.parameter_name == parameter_name)
    
    if element_id:
        query = query.filter(CSVDataRow.element_id == element_id)
    
    # Поиск по всем текстовым полям
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                CSVDataRow.model_name.ilike(search_pattern),
                CSVDataRow.element_id.ilike(search_pattern),
                CSVDataRow.category.ilike(search_pattern),
                CSVDataRow.parameter_name.ilike(search_pattern),
                CSVDataRow.parameter_value.ilike(search_pattern),
            )
        )
    
    # Если запрашиваются только уникальные значения для фильтров
    if distinct_only:
        from sqlalchemy import distinct
        # Используем base_query_for_distinct (без фильтров по category и parameter_name)
        # чтобы получить все доступные уникальные значения
        
        # Получаем уникальные категории из уже отфильтрованного набора данных
        categories_query = base_query_for_distinct.with_entities(distinct(CSVDataRow.category)).filter(
            CSVDataRow.category.isnot(None),
            CSVDataRow.category != ""
        )
        
        # Получаем уникальные параметры из уже отфильтрованного набора данных
        parameters_query = base_query_for_distinct.with_entities(distinct(CSVDataRow.parameter_name)).filter(
            CSVDataRow.parameter_name.isnot(None),
            CSVDataRow.parameter_name != ""
        )
        
        # Получаем списки уникальных значений
        unique_categories = sorted([cat[0] for cat in categories_query.all() if cat[0]])
        unique_parameters = sorted([param[0] for param in parameters_query.all() if param[0]])
        
        return {
            "categories": unique_categories,
            "parameters": unique_parameters,
            "total": len(unique_categories) + len(unique_parameters),
        }
    
    # Получаем общее количество (до сортировки и пагинации)
    total = query.count()
    
    # Применяем сортировку
    sort_field_map = {
        "row_number": CSVDataRow.row_number,
        "model_name": CSVDataRow.model_name,
        "element_id": CSVDataRow.element_id,
        "category": CSVDataRow.category,
        "parameter_name": CSVDataRow.parameter_name,
        "parameter_value": CSVDataRow.parameter_value,
        "created_at": CSVDataRow.created_at,
    }
    
    sort_field = sort_field_map.get(sort_by, CSVDataRow.row_number)
    if sort_order and sort_order.lower() == "desc":
        query = query.order_by(desc(sort_field))
    else:
        query = query.order_by(asc(sort_field))
    
    # Применяем пагинацию
    records = query.offset(offset).limit(limit).all()
    
    # Преобразуем в словари
    result = []
    for record in records:
        result.append({
            "id": str(record.id),
            "file_upload_id": str(record.file_upload_id),
            "user_id": str(record.user_id),
            "project_id": str(record.project_id),
            "version_id": str(record.version_id),
            "row_number": record.row_number,
            "model_name": record.model_name,
            "element_id": record.element_id,
            "category": record.category,
            "parameter_name": record.parameter_name,
            "parameter_value": record.parameter_value,
            "data": record.data,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total,
        "data": result
    }


@router.delete("/upload/{file_upload_id}/data")
async def delete_csv_data(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Удалить все CSV данные для файла
    
    Returns:
        Результат удаления
    """
    # Проверяем, что файл существует
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Удаляем данные
    deleted_count = db.query(CSVDataRow).filter(
        CSVDataRow.file_upload_id == file_upload_id
    ).delete()
    
    db.commit()
    
    return {
        "success": True,
        "deleted_count": deleted_count,
        "file_upload_id": str(file_upload_id)
    }

