"""
Настройка подключения к базе данных
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings
import sys

# Определяем DATABASE_URL - ОБЯЗАТЕЛЬНО PostgreSQL
database_url = settings.DATABASE_URL

# КРИТИЧЕСКИ ВАЖНО: Universe использует ТОЛЬКО PostgreSQL, SQLite НЕ поддерживается
if not database_url.startswith("postgresql://"):
    print("❌ ОШИБКА: DATABASE_URL должен указывать на PostgreSQL!")
    print(f"   Текущий DATABASE_URL: {database_url}")
    print("   Universe не поддерживает SQLite. Проверьте настройки в .env файле.")
    sys.exit(1)

# Проверяем подключение к PostgreSQL при старте
try:
    print("🔌 Проверяем подключение к PostgreSQL...")
    test_engine = create_engine(database_url, poolclass=NullPool, connect_args={"connect_timeout": 5})
    test_conn = test_engine.connect()
    test_conn.close()
    test_engine.dispose()
    print("✅ Подключение к PostgreSQL успешно")
except Exception as e:
    print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться к PostgreSQL!")
    # Маскируем пароль в выводе
    masked_url = database_url
    if "@" in database_url:
        parts = database_url.split("@")
        user_pass = parts[0].split("//")[1] if "//" in parts[0] else parts[0]
        if ":" in user_pass:
            user = user_pass.split(":")[0]
            masked_url = database_url.replace(user_pass, f"{user}:***")
    print(f"   DATABASE_URL: {masked_url}")
    print(f"   Ошибка: {type(e).__name__}: {e}")
    print("   Universe требует PostgreSQL для работы. Проверьте:")
    print("   1. PostgreSQL запущен и доступен")
    print("   2. DATABASE_URL в .env файле указан правильно")
    print("   3. Пользователь и пароль корректны")
    print("   4. База данных существует")
    print("   5. pg_hba.conf разрешает подключения")
    sys.exit(1)

# Создаем engine для PostgreSQL
engine = create_engine(
    database_url,
    poolclass=NullPool,
    echo=False,
    connect_args={"connect_timeout": 5}
)

# Создаем сессию
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей
Base = declarative_base()


async def init_db():
    """Инициализация базы данных"""
    # Импортируем все модели для их регистрации в Base.metadata
    from app.models import universe_user  # noqa: F401
    from app.models import project  # noqa: F401
    from app.models import upload  # noqa: F401
    from app.models import pivot  # noqa: F401

    # Для PostgreSQL таблицы создаются вручную через миграции
    # Проверяем, что таблицы существуют
    try:
        print("📦 Проверяем наличие таблиц в PostgreSQL...")
        # Просто проверяем подключение - таблицы должны быть созданы через миграции
        Base.metadata.create_all(bind=engine)
        print("✅ Таблицы готовы")
    except Exception as e:
        print(f"❌ Не удалось проверить таблицы: {e}")
        raise


def get_db():
    """Dependency для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
