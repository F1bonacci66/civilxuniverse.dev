"""
Конфигурация приложения
"""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List
import os


DEFAULT_RVT_EXPORTER_PATH = r"C:\Projects\CSVExporter\013 noBIM_Full prarams 18.09.2024\export\RvtExporterCfg1.exe"
DEFAULT_RVT_EXPORTER_WORKDIR = os.path.dirname(DEFAULT_RVT_EXPORTER_PATH)


class Settings(BaseSettings):
    """Настройки приложения"""
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",  # Игнорировать дополнительные поля из .env
    )
    
    # Database (PostgreSQL для данных Universe)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/civilx_universe"
    )
    
    # MySQL (для существующей базы пользователей)
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "u3279080_CivilX_users")
    MYSQL_USER: str = os.getenv("MYSQL_USER", "u3279080_civilx_user")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    
    # File Storage
    STORAGE_TYPE: str = os.getenv("STORAGE_TYPE", "minio")  # minio или s3
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "civilx-universe")
    MINIO_USE_SSL: bool = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    
    # AWS S3
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "civilx-universe")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    
    # Conversion Tools
    RVT2IFC_CONVERTER_PATH: str = os.getenv(
        "RVT2IFC_CONVERTER_PATH",
        "C:\\Projects\\gitExporter\\DDC_CONVERTER_Revit2IFC\\DDC_REVIT2IFC_CONVERTER\\RVT2IFCconverter.exe"
    )
    RVT2CSV_EXPORTER_PATH: str = os.getenv(
        "RVT2CSV_EXPORTER_PATH",
        DEFAULT_RVT_EXPORTER_PATH,
    )
    RVT2CSV_EXPORTER_WORKDIR: str = os.getenv(
        "RVT2CSV_EXPORTER_WORKDIR",
        DEFAULT_RVT_EXPORTER_WORKDIR,
    )
    RVT2CSV_EXPORT_TIMEOUT_SECONDS: int = int(
        os.getenv("RVT2CSV_EXPORT_TIMEOUT_SECONDS", "900")
    )
    RVT2CSV_WINE_PREFIX: str = os.getenv(
        "RVT2CSV_WINE_PREFIX", "/app/.wine-prefix"
    )
    PYTHON_EXECUTABLE: str = os.getenv("PYTHON_EXECUTABLE", "py")
    IFC_TO_CSV_SCRIPT_PATH: str = os.getenv(
        "IFC_TO_CSV_SCRIPT_PATH",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scripts", "ifc_to_csv_dataviewer.py")
    )
    
    # API
    API_BASE_URL: str = os.getenv("API_BASE_URL", "http://localhost:8000")
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3001,http://localhost:3000"
    ).split(",")
    
    # JWT (должен совпадать с PHP auth-api.php)
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        "your_super_secret_jwt_key_for_php"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )
    
    # Celery
    CELERY_BROKER_URL: str = os.getenv(
        "CELERY_BROKER_URL",
        "redis://localhost:6379/0"
    )
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND",
        "redis://localhost:6379/0"
    )
    
    # Conversion
    CONVERSION_MAX_PARALLEL_JOBS: int = int(
        os.getenv("CONVERSION_MAX_PARALLEL_JOBS", "10")
    )
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()

