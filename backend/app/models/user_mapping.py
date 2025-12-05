"""
Модель маппинга пользователей между MySQL и PostgreSQL
"""
from sqlalchemy import Column, String, Integer, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base
from app.models.upload import GUID

UUID_Type = GUID


class UserMapping(Base):
    """Модель маппинга пользователей MySQL (INT) -> PostgreSQL (UUID)"""
    __tablename__ = "user_mapping"
    
    id = Column(UUID_Type(), primary_key=True, default=lambda: str(uuid.uuid4()))
    mysql_user_id = Column(Integer, nullable=False, unique=True, index=True)
    postgres_user_id = Column(UUID_Type(), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('mysql_user_id', name='unique_mysql_user_id'),
        UniqueConstraint('postgres_user_id', name='unique_postgres_user_id'),
        UniqueConstraint('email', name='unique_email'),
    )
    
    def __repr__(self):
        return f"<UserMapping(mysql_id={self.mysql_user_id}, postgres_id={self.postgres_user_id}, email={self.email})>"





