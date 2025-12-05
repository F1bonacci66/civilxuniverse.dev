"""
JWT аутентификация и авторизация
Интеграция с существующей системой авторизации PHP
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.users_database import get_users_db, UsersDatabase
from app.core.database import get_db
from app.core.user_mapping_service import get_or_create_postgres_user_id
from typing import Optional, Dict
import os


# HTTPBearer для извлечения токена из заголовка Authorization
security = HTTPBearer()


def verify_jwt_token(token: str) -> Optional[Dict]:
    """
    Верификация JWT токена, созданного PHP
    
    Args:
        token: JWT токен из заголовка Authorization
        
    Returns:
        Словарь с данными из токена (user_id, email, user_type) или None
    """
    try:
        # Используем тот же секрет, что и в PHP
        jwt_secret = os.getenv("JWT_SECRET_KEY", settings.JWT_SECRET_KEY)
        
        # Декодируем токен
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Извлекаем данные
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        user_type: str = payload.get("user_type")
        
        if user_id is None or email is None:
            return None
        
        return {
            "user_id": user_id,
            "email": email,
            "user_type": user_type,
        }
    except JWTError:
        # Токен невалиден или истек
        return None
    except Exception as e:
        print(f"Ошибка верификации JWT: {e}")
        return None


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """
    Dependency для получения user_id из JWT токена
    
    Использование:
        @router.get("/endpoint")
        async def my_endpoint(user_id: int = Depends(get_current_user_id)):
            ...
    
    Raises:
        HTTPException: Если токен невалиден или отсутствует
    """
    token = credentials.credentials
    
    # Верифицируем токен
    token_data = verify_jwt_token(token)
    
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истекший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token_data["user_id"]


async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    users_db: UsersDatabase = Depends(get_users_db),
) -> Dict:
    """
    Dependency для получения полной информации о пользователе
    
    Использование:
        @router.get("/endpoint")
        async def my_endpoint(user: Dict = Depends(get_current_user)):
            ...
    
    Returns:
        Словарь с полной информацией о пользователе из MySQL
    """
    user = users_db.get_user_by_id(user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь неактивен",
        )
    
    return user


async def get_current_postgres_user_id(
    mysql_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    users_db: UsersDatabase = Depends(get_users_db),
) -> str:
    """
    Dependency для получения PostgreSQL user_id (UUID) из JWT токена
    Создает маппинг если его еще нет
    
    Использование:
        @router.get("/endpoint")
        async def my_endpoint(postgres_user_id: str = Depends(get_current_postgres_user_id)):
            ...
    
    Returns:
        PostgreSQL user_id (UUID в виде строки)
    """
    # Получаем email пользователя из MySQL
    user = users_db.get_user_by_id(mysql_user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден в MySQL",
        )
    
    email = user.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email пользователя не найден",
        )
    
    # Получаем или создаем PostgreSQL user_id
    postgres_user_id = get_or_create_postgres_user_id(db, mysql_user_id, email)
    
    return postgres_user_id


# Опциональная авторизация (для endpoints, где токен необязателен)
async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[int]:
    """
    Dependency для получения user_id, если токен присутствует (опционально)
    
    Использование:
        @router.get("/endpoint")
        async def my_endpoint(user_id: Optional[int] = Depends(get_optional_user_id)):
            if user_id:
                # Пользователь авторизован
            else:
                # Анонимный доступ
    """
    if credentials is None:
        return None
    
    token = credentials.credentials
    token_data = verify_jwt_token(token)
    
    if token_data is None:
        return None
    
    return token_data["user_id"]



