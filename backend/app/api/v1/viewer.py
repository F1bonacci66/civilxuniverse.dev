"""
API endpoints для 3D Viewer
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import json
import os
import tempfile

from app.core.database import get_db
from app.core.storage import storage_service
from app.models.upload import FileUpload, ViewerGroup
from app.schemas.upload import (
    FileUploadResponse,
    ViewerGroupCreate,
    ViewerGroupUpdate,
    ViewerGroupResponse,
)

router = APIRouter()


@router.get("/{file_upload_id}/xkt")
async def get_xkt_file(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Получить XKT файл для 3D визуализации
    
    Args:
        file_upload_id: ID загруженного файла (RVT или IFC)
    
    Returns:
        XKT файл через FileResponse
    """
    # Получаем запись FileUpload
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Проверяем, есть ли XKT файл
    if not file_upload.xkt_file_path:
        raise HTTPException(
            status_code=404,
            detail="XKT file not found. The file may not have been converted to XKT yet."
        )
    
    try:
        # Извлекаем путь из storage_path
        storage_path = file_upload.xkt_file_path
        if storage_path.startswith("local://"):
            storage_path = storage_path[8:]
        elif storage_path.startswith("minio://"):
            # Извлекаем путь после minio://bucket/
            parts = storage_path.split("/", 2)
            if len(parts) > 2:
                storage_path = parts[2]
        
        # Используем поток для скачивания (более эффективно для больших файлов)
        file_stream = storage_service.get_file_stream(storage_path)
        
        # Определяем имя файла
        xkt_filename = os.path.basename(storage_path) or f"{file_upload.original_filename}.xkt"
        
        return StreamingResponse(
            file_stream,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'inline; filename="{xkt_filename}"',
                "Content-Type": "application/octet-stream",
            },
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="XKT file not found in storage")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading XKT file: {str(e)}")


@router.get("/{file_upload_id}/metadata")
async def get_metadata(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Получить metadata.json для 3D визуализации
    
    Args:
        file_upload_id: ID загруженного файла (RVT или IFC)
    
    Returns:
        metadata.json через JSONResponse
    """
    # Получаем запись FileUpload
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Проверяем, есть ли metadata файл
    if not file_upload.metadata_file_path:
        raise HTTPException(
            status_code=404,
            detail="Metadata file not found. The file may not have been converted to XKT yet."
        )
    
    try:
        # Извлекаем путь из storage_path
        storage_path = file_upload.metadata_file_path
        if storage_path.startswith("local://"):
            storage_path = storage_path[8:]
        elif storage_path.startswith("minio://"):
            # Извлекаем путь после minio://bucket/
            parts = storage_path.split("/", 2)
            if len(parts) > 2:
                storage_path = parts[2]
        
        # Получаем файл из хранилища
        metadata_bytes = storage_service.get_file(storage_path)
        
        # Парсим JSON
        metadata = json.loads(metadata_bytes.decode("utf-8"))
        
        return JSONResponse(content=metadata)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Metadata file not found in storage")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Error parsing metadata JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading metadata file: {str(e)}")


@router.get("/{file_upload_id}/status")
async def get_viewer_status(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Получить статус конвертации XKT для 3D визуализации
    
    Args:
        file_upload_id: ID загруженного файла (RVT или IFC)
    
    Returns:
        Статус конвертации XKT:
        {
            "xkt_conversion_status": "pending" | "processing" | "completed" | "failed" | null,
            "xkt_file_path": str | null,
            "metadata_file_path": str | null,
            "has_xkt": bool,
            "has_metadata": bool
        }
    """
    # Получаем запись FileUpload
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    return {
        "xkt_conversion_status": file_upload.xkt_conversion_status,
        "xkt_file_path": file_upload.xkt_file_path,
        "metadata_file_path": file_upload.metadata_file_path,
        "has_xkt": bool(file_upload.xkt_file_path),
        "has_metadata": bool(file_upload.metadata_file_path),
    }


@router.post("/{file_upload_id}/groups", response_model=ViewerGroupResponse)
async def create_viewer_group(
    file_upload_id: UUID,
    group_data: ViewerGroupCreate,
    db: Session = Depends(get_db),
):
    """
    Создать новый набор элементов для 3D Viewer
    
    Args:
        file_upload_id: ID загруженного файла
        group_data: Данные набора элементов
    
    Returns:
        Созданный набор элементов
    """
    # Проверяем, что файл существует
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Создаем новый набор
    viewer_group = ViewerGroup(
        file_upload_id=file_upload_id,
        user_id=group_data.user_id,
        name=group_data.name,
        description=group_data.description,
        element_ids=group_data.element_ids,  # JSON массив строк
    )
    
    db.add(viewer_group)
    db.commit()
    db.refresh(viewer_group)
    
    return ViewerGroupResponse(
        id=str(viewer_group.id),
        file_upload_id=str(viewer_group.file_upload_id),
        user_id=str(viewer_group.user_id),
        name=viewer_group.name,
        description=viewer_group.description,
        element_ids=viewer_group.element_ids,
        created_at=viewer_group.created_at.isoformat() if viewer_group.created_at else None,
        updated_at=viewer_group.updated_at.isoformat() if viewer_group.updated_at else None,
    )


@router.get("/{file_upload_id}/groups", response_model=List[ViewerGroupResponse])
async def get_viewer_groups(
    file_upload_id: UUID,
    user_id: Optional[UUID] = Query(None, description="ID пользователя для фильтрации (опционально)"),
    db: Session = Depends(get_db),
):
    """
    Получить список наборов элементов для 3D Viewer
    
    Args:
        file_upload_id: ID загруженного файла
        user_id: ID пользователя для фильтрации (опционально)
    
    Returns:
        Список наборов элементов
    """
    # Проверяем, что файл существует
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Запрашиваем наборы
    query = db.query(ViewerGroup).filter(ViewerGroup.file_upload_id == file_upload_id)
    
    # Фильтруем по user_id, если указан
    if user_id:
        query = query.filter(ViewerGroup.user_id == user_id)
    
    viewer_groups = query.order_by(ViewerGroup.created_at.desc()).all()
    
    return [
        ViewerGroupResponse(
            id=str(group.id),
            file_upload_id=str(group.file_upload_id),
            user_id=str(group.user_id),
            name=group.name,
            description=group.description,
            element_ids=group.element_ids,
            created_at=group.created_at.isoformat() if group.created_at else None,
            updated_at=group.updated_at.isoformat() if group.updated_at else None,
        )
        for group in viewer_groups
    ]


@router.put("/{file_upload_id}/groups/{group_id}", response_model=ViewerGroupResponse)
async def update_viewer_group(
    file_upload_id: UUID,
    group_id: UUID,
    group_data: ViewerGroupUpdate,
    db: Session = Depends(get_db),
):
    """
    Обновить набор элементов для 3D Viewer
    
    Args:
        file_upload_id: ID загруженного файла
        group_id: ID набора элементов
        group_data: Данные для обновления набора
    
    Returns:
        Обновленный набор элементов
    """
    # Проверяем, что файл существует
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Получаем набор
    viewer_group = db.query(ViewerGroup).filter(
        ViewerGroup.id == group_id,
        ViewerGroup.file_upload_id == file_upload_id,
    ).first()
    
    if not viewer_group:
        raise HTTPException(status_code=404, detail="Viewer group not found")
    
    # Проверяем права доступа (только владелец может обновлять)
    if viewer_group.user_id != group_data.user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to update this group")
    
    # Обновляем поля
    if group_data.name is not None:
        viewer_group.name = group_data.name
    if group_data.description is not None:
        viewer_group.description = group_data.description
    if group_data.element_ids is not None:
        viewer_group.element_ids = group_data.element_ids
    
    db.commit()
    db.refresh(viewer_group)
    
    return ViewerGroupResponse(
        id=str(viewer_group.id),
        file_upload_id=str(viewer_group.file_upload_id),
        user_id=str(viewer_group.user_id),
        name=viewer_group.name,
        description=viewer_group.description,
        element_ids=viewer_group.element_ids,
        created_at=viewer_group.created_at.isoformat() if viewer_group.created_at else None,
        updated_at=viewer_group.updated_at.isoformat() if viewer_group.updated_at else None,
    )


@router.delete("/{file_upload_id}/groups/{group_id}")
async def delete_viewer_group(
    file_upload_id: UUID,
    group_id: UUID,
    user_id: UUID = Query(..., description="ID пользователя (для проверки прав)"),
    db: Session = Depends(get_db),
):
    """
    Удалить набор элементов для 3D Viewer
    
    Args:
        file_upload_id: ID загруженного файла
        group_id: ID набора элементов
        user_id: ID пользователя (для проверки прав)
    
    Returns:
        Сообщение об успешном удалении
    """
    # Проверяем, что файл существует
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    
    if not file_upload:
        raise HTTPException(status_code=404, detail="File upload not found")
    
    # Получаем набор
    viewer_group = db.query(ViewerGroup).filter(
        ViewerGroup.id == group_id,
        ViewerGroup.file_upload_id == file_upload_id,
    ).first()
    
    if not viewer_group:
        raise HTTPException(status_code=404, detail="Viewer group not found")
    
    # Проверяем права доступа (только владелец может удалять)
    if viewer_group.user_id != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this group")
    
    # Удаляем набор
    db.delete(viewer_group)
    db.commit()
    
    return {"message": "Viewer group deleted successfully"}

