"""
API эндпоинты для настроек экспорта
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.upload import ExportSettings
from app.schemas.upload import ExportSettingsResponse, ExportSettingsCreate

router = APIRouter()


@router.get("", response_model=List[ExportSettingsResponse])
async def get_export_settings(
    user_id: UUID = None,  # TODO: получать из JWT токена
    db: Session = Depends(get_db),
):
    """Получить список настроек экспорта"""
    query = db.query(ExportSettings)
    if user_id:
        query = query.filter(ExportSettings.user_id == user_id)
    
    settings = query.order_by(ExportSettings.created_at.desc()).all()
    return [ExportSettingsResponse.model_validate(s) for s in settings]


@router.post("", response_model=ExportSettingsResponse)
async def create_export_settings(
    settings: ExportSettingsCreate,
    db: Session = Depends(get_db),
):
    """Создать настройки экспорта"""
    db_settings = ExportSettings(**settings.model_dump())
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    
    return ExportSettingsResponse.model_validate(db_settings)


@router.put("/{settings_id}", response_model=ExportSettingsResponse)
async def update_export_settings(
    settings_id: UUID,
    settings: ExportSettingsCreate,
    db: Session = Depends(get_db),
):
    """Обновить настройки экспорта"""
    db_settings = db.query(ExportSettings).filter(ExportSettings.id == settings_id).first()
    if not db_settings:
        raise HTTPException(status_code=404, detail="Настройки не найдены")
    
    for key, value in settings.model_dump().items():
        setattr(db_settings, key, value)
    
    db.commit()
    db.refresh(db_settings)
    
    return ExportSettingsResponse.model_validate(db_settings)


@router.delete("/{settings_id}")
async def delete_export_settings(
    settings_id: UUID,
    db: Session = Depends(get_db),
):
    """Удалить настройки экспорта"""
    db_settings = db.query(ExportSettings).filter(ExportSettings.id == settings_id).first()
    if not db_settings:
        raise HTTPException(status_code=404, detail="Настройки не найдены")
    
    db.delete(db_settings)
    db.commit()
    
    return {"message": "Настройки успешно удалены"}







