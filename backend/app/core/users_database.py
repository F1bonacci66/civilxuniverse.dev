"""
Подключение к MySQL базе данных пользователей (CivilX_users)
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings
from typing import Optional, Dict
import os


class UsersDatabase:
    """Класс для работы с MySQL базой пользователей"""
    
    def __init__(self):
        """Инициализация подключения к MySQL"""
        # Получаем параметры подключения из настроек
        mysql_host = os.getenv("MYSQL_HOST", "localhost")
        mysql_database = os.getenv("MYSQL_DATABASE", "u3279080_CivilX_users")
        mysql_user = os.getenv("MYSQL_USER", "u3279080_civilx_user")
        mysql_password = os.getenv("MYSQL_PASSWORD", "")
        
        # Формируем URL подключения для MySQL
        # Пробуем использовать mysql-connector-python (лучше работает с MySQL 8.0+)
        # Если не установлен, используем PyMySQL
        try:
            import mysql.connector
            # Используем mysql-connector-python
            mysql_url = f"mysql+mysqlconnector://{mysql_user}:{mysql_password}@{mysql_host}/{mysql_database}?charset=utf8mb4"
        except ImportError:
            # Используем PyMySQL как fallback
            mysql_url = f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}/{mysql_database}?charset=utf8mb4"
        
        self.engine = create_engine(
            mysql_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,  # Проверять соединение перед использованием
            echo=False,
        )
        
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    def get_session(self):
        """Получить сессию MySQL"""
        return self.SessionLocal()
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        """
        Получить пользователя по ID из MySQL
        
        Args:
            user_id: ID пользователя (INT из MySQL)
            
        Returns:
            Словарь с данными пользователя или None
        """
        session = self.get_session()
        try:
            result = session.execute(
                text("SELECT id, login, email, name, user_type, company_name, phone, is_active, created_at FROM users WHERE id = :user_id AND is_active = 1"),
                {"user_id": user_id}
            ).fetchone()
            
            if result:
                return {
                    "id": result[0],
                    "login": result[1],
                    "email": result[2],
                    "name": result[3],
                    "user_type": result[4],
                    "company_name": result[5],
                    "phone": result[6],
                    "is_active": bool(result[7]),
                    "created_at": result[8],
                }
            return None
        finally:
            session.close()
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """
        Получить пользователя по email из MySQL
        
        Args:
            email: Email пользователя
            
        Returns:
            Словарь с данными пользователя или None
        """
        session = self.get_session()
        try:
            result = session.execute(
                text("SELECT id, login, email, name, user_type, company_name, phone, is_active, created_at FROM users WHERE email = :email AND is_active = 1"),
                {"email": email}
            ).fetchone()
            
            if result:
                return {
                    "id": result[0],
                    "login": result[1],
                    "email": result[2],
                    "name": result[3],
                    "user_type": result[4],
                    "company_name": result[5],
                    "phone": result[6],
                    "is_active": bool(result[7]),
                    "created_at": result[8],
                }
            return None
        finally:
            session.close()


# Глобальный экземпляр
_users_db: Optional[UsersDatabase] = None


def get_users_db() -> UsersDatabase:
    """Получить экземпляр UsersDatabase (singleton)"""
    global _users_db
    if _users_db is None:
        _users_db = UsersDatabase()
    return _users_db



