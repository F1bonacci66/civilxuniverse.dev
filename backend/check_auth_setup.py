"""
Скрипт для проверки настройки аутентификации
"""
import os
from dotenv import load_dotenv
from app.core.config import settings
from app.core.database import get_db, engine
from sqlalchemy import text
# Импортируем модель, чтобы SQLAlchemy знал о ней
from app.models.user_mapping import UserMapping

# Загружаем переменные окружения
load_dotenv()

def check_jwt_secret():
    """Проверка JWT секрета"""
    print("=" * 60)
    print("Проверка JWT_SECRET_KEY")
    print("=" * 60)
    
    jwt_secret = os.getenv("JWT_SECRET_KEY", settings.JWT_SECRET_KEY)
    php_secret = "your_super_secret_jwt_key_for_php"
    
    print(f"Backend JWT_SECRET_KEY: {jwt_secret}")
    print(f"PHP JWT_SECRET (ожидаемый): {php_secret}")
    
    if jwt_secret == php_secret:
        print("✅ JWT_SECRET_KEY совпадает с PHP")
    else:
        print("⚠️  JWT_SECRET_KEY НЕ совпадает с PHP!")
        print("   Установите в .env: JWT_SECRET_KEY=your_super_secret_jwt_key_for_php")
    
    print()

def check_user_mapping_table():
    """Проверка таблицы user_mapping"""
    print("=" * 60)
    print("Проверка таблицы user_mapping")
    print("=" * 60)
    
    try:
        db = next(get_db())
        
        # Проверяем существование таблицы (для PostgreSQL)
        if str(engine.url).startswith('postgresql'):
            result = db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'user_mapping'
                );
            """))
        else:
            # Для SQLite
            result = db.execute(text("""
                SELECT EXISTS (
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='user_mapping'
                );
            """))
        
        table_exists = result.scalar()
        
        if table_exists:
            print("✅ Таблица user_mapping существует")
            
            # Проверяем структуру (для PostgreSQL)
            if str(engine.url).startswith('postgresql'):
                result = db.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'user_mapping'
                    ORDER BY ordinal_position;
                """))
            else:
                # Для SQLite
                result = db.execute(text("PRAGMA table_info(user_mapping)"))
            
            columns = result.fetchall()
            print("\nСтруктура таблицы:")
            for col_name, col_type in columns:
                print(f"  - {col_name}: {col_type}")
            
            # Проверяем количество записей
            result = db.execute(text("SELECT COUNT(*) FROM user_mapping"))
            count = result.scalar()
            print(f"\nКоличество записей: {count}")
            
        else:
            print("❌ Таблица user_mapping НЕ существует!")
            print("   Выполните: psql -U postgres -d civilx_universe -f database/create-user-mapping-table.sql")
        
        db.close()
        
    except Exception as e:
        print(f"❌ Ошибка при проверке таблицы: {e}")
        print("   Убедитесь, что PostgreSQL запущен и база данных доступна")
    
    print()

def check_mysql_connection():
    """Проверка подключения к MySQL"""
    print("=" * 60)
    print("Проверка подключения к MySQL")
    print("=" * 60)
    
    # Проверяем настройки
    mysql_host = os.getenv("MYSQL_HOST", "localhost")
    mysql_database = os.getenv("MYSQL_DATABASE", "u3279080_CivilX_users")
    mysql_user = os.getenv("MYSQL_USER", "u3279080_civilx_user")
    mysql_password = os.getenv("MYSQL_PASSWORD", "")
    
    print(f"   Host: {mysql_host}")
    print(f"   Database: {mysql_database}")
    print(f"   User: {mysql_user}")
    print(f"   Password: {'*' * len(mysql_password) if mysql_password else '(не установлен)'}")
    
    if not mysql_password:
        print("   ⚠️  Пароль MySQL не установлен в .env")
        print("   Это нормально для локальной разработки, но на сервере нужно установить MYSQL_PASSWORD")
        print("   Пропускаем проверку подключения...")
        print()
        return
    
    print()
    
    try:
        from app.core.users_database import get_users_db
        
        users_db = get_users_db()
        session = users_db.get_session()
        
        # Пробуем выполнить простой запрос
        result = session.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        
        print(f"✅ Подключение к MySQL успешно")
        print(f"   Количество пользователей в MySQL: {count}")
        
        session.close()
        
    except Exception as e:
        print(f"❌ Ошибка подключения к MySQL: {e}")
        print("   Проверьте настройки MYSQL_* в .env")
        print(f"   Тип ошибки: {type(e).__name__}")
        
        # Дополнительная информация
        if "Access denied" in str(e) or "authentication" in str(e).lower():
            print("   💡 Возможные причины:")
            print("      - Неверный пароль MySQL")
            print("      - Пользователь не имеет прав доступа")
            print("      - MySQL сервер не запущен")
        elif "Can't connect" in str(e) or "Connection refused" in str(e):
            print("   💡 Возможные причины:")
            print("      - MySQL сервер не запущен")
            print("      - Неверный хост или порт")
        else:
            import traceback
            print(f"   Детали: {traceback.format_exc()}")
    
    print()

if __name__ == "__main__":
    print("\n🔍 Проверка настройки аутентификации CivilX.Universe\n")
    
    check_jwt_secret()
    check_user_mapping_table()
    check_mysql_connection()
    
    print("=" * 60)
    print("Проверка завершена")
    print("=" * 60)

