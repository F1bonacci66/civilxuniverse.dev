"""
Pydantic схемы для валидации данных проектов и версий
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
import re


# Project Schemas
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Название проекта")
    description: Optional[str] = Field(None, description="Описание проекта")
    slug: Optional[str] = Field(None, description="URL-дружественный идентификатор (автоматически генерируется если не указан)")


class ProjectCreate(ProjectBase):
    """Схема для создания проекта"""
    pass


class ProjectUpdate(BaseModel):
    """Схема для обновления проекта"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    slug: Optional[str] = None


class ProjectResponse(ProjectBase):
    """Схема для ответа API"""
    id: UUID
    short_id: int
    created_by: UUID
    company_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


# ProjectVersion Schemas
class ProjectVersionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Название версии")
    description: Optional[str] = Field(None, description="Описание версии")
    slug: Optional[str] = Field(None, description="URL-дружественный идентификатор (автоматически генерируется если не указан)")


class ProjectVersionCreate(ProjectVersionBase):
    """Схема для создания версии проекта"""
    pass


class ProjectVersionUpdate(BaseModel):
    """Схема для обновления версии проекта"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    slug: Optional[str] = None


class ProjectVersionResponse(ProjectVersionBase):
    """Схема для ответа API"""
    id: UUID
    short_id: int
    project_id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


# Utility functions
def generate_slug(text: str) -> str:
    """Генерирует URL-дружественный slug из текста"""
    # Транслитерация кириллицы
    translit_map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    }
    
    # Транслитерация
    result = ''
    for char in text:
        result += translit_map.get(char, char)
    
    # Преобразуем в lowercase и заменяем пробелы/спецсимволы на дефисы
    slug = re.sub(r'[^\w\s-]', '', result.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.strip('-')
    
    # Если slug пустой, используем дефолтное значение
    if not slug:
        slug = 'unnamed'
    
    return slug





