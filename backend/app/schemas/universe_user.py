"""
Схемы для пользователей Universe
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserRegister(BaseModel):
    """Схема регистрации пользователя"""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Пароль должен содержать минимум 8 символов")
    name: str = Field(..., min_length=2, max_length=255)
    company_name: Optional[str] = Field(None, max_length=255, description="Название компании (необязательно)")


class UserLogin(BaseModel):
    """Схема входа пользователя"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя"""
    id: UUID
    email: str
    name: str
    company_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Схема обновления пользователя"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    company_name: Optional[str] = Field(None, max_length=255)


class PasswordChange(BaseModel):
    """Схема смены пароля"""
    current_password: str
    new_password: str = Field(..., min_length=8, description="Пароль должен содержать минимум 8 символов")


class TokenResponse(BaseModel):
    """Схема ответа с токеном"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

