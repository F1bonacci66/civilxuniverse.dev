"""
Модель пользователя Universe
"""
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.sql import func
import uuid

from app.core.database import Base
from app.models.upload import GUID  # Используем GUID для совместимости

UUID_Type = GUID


class UniverseUser(Base):
    """Пользователь Universe"""
    __tablename__ = "universe_users"
    
    id = Column(UUID_Type(), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self):
        return f"<UniverseUser(id={self.id}, email={self.email}, name={self.name})>"

