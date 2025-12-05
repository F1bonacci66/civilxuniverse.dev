"""
Сервис для работы с маппингом пользователей между MySQL и PostgreSQL
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional
import uuid

from app.models.user_mapping import UserMapping
from app.core.users_database import get_users_db, UsersDatabase


def get_or_create_postgres_user_id(db: Session, mysql_user_id: int, email: str) -> str:
    """
    Получить или создать PostgreSQL user_id для MySQL user_id
    
    Args:
        db: Сессия PostgreSQL
        mysql_user_id: ID пользователя из MySQL
        email: Email пользователя для проверки
        
    Returns:
        PostgreSQL user_id (UUID в виде строки)
    """
    # Проверяем существующий маппинг
    mapping = db.query(UserMapping).filter(
        UserMapping.mysql_user_id == mysql_user_id
    ).first()
    
    if mapping:
        # Проверяем, что email совпадает (на случай изменения)
        if mapping.email != email:
            mapping.email = email
            db.commit()
        return str(mapping.postgres_user_id)
    
    # Проверяем по email (на случай если пользователь уже есть с другим mysql_user_id)
    mapping_by_email = db.query(UserMapping).filter(
        UserMapping.email == email
    ).first()
    
    if mapping_by_email:
        # Обновляем mysql_user_id если он изменился
        if mapping_by_email.mysql_user_id != mysql_user_id:
            mapping_by_email.mysql_user_id = mysql_user_id
            db.commit()
        return str(mapping_by_email.postgres_user_id)
    
    # Создаем новый маппинг
    postgres_user_id = str(uuid.uuid4())
    
    new_mapping = UserMapping(
        mysql_user_id=mysql_user_id,
        postgres_user_id=postgres_user_id,
        email=email
    )
    
    db.add(new_mapping)
    db.commit()
    db.refresh(new_mapping)
    
    return postgres_user_id


def get_postgres_user_id(db: Session, mysql_user_id: int) -> Optional[str]:
    """
    Получить PostgreSQL user_id по MySQL user_id
    
    Args:
        db: Сессия PostgreSQL
        mysql_user_id: ID пользователя из MySQL
        
    Returns:
        PostgreSQL user_id (UUID в виде строки) или None
    """
    mapping = db.query(UserMapping).filter(
        UserMapping.mysql_user_id == mysql_user_id
    ).first()
    
    if mapping:
        return str(mapping.postgres_user_id)
    
    return None


def get_mysql_user_id(db: Session, postgres_user_id: str) -> Optional[int]:
    """
    Получить MySQL user_id по PostgreSQL user_id
    
    Args:
        db: Сессия PostgreSQL
        postgres_user_id: UUID пользователя в PostgreSQL
        
    Returns:
        MySQL user_id (INT) или None
    """
    mapping = db.query(UserMapping).filter(
        UserMapping.postgres_user_id == postgres_user_id
    ).first()
    
    if mapping:
        return mapping.mysql_user_id
    
    return None





