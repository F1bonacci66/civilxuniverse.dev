"""
Утилиты для работы с хранилищем файлов
"""
import re
from pathlib import Path
from typing import Optional
from uuid import UUID


def sanitize_filename(filename: str) -> str:
    """
    Создать безопасное имя файла/папки для файловой системы
    
    Удаляет или заменяет недопустимые символы:
    - Windows: < > : " | ? * \ /
    - Unix: /
    """
    # Удаляем недопустимые символы
    invalid_chars = r'[<>:"|?*\\/]'
    sanitized = re.sub(invalid_chars, '_', filename)
    
    # Удаляем точки в начале/конце (проблемы в Windows)
    sanitized = sanitized.strip('. ')
    
    # Ограничиваем длину (максимум 255 символов для Windows)
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    
    # Если имя пустое после очистки, используем дефолтное
    if not sanitized:
        sanitized = 'unnamed'
    
    return sanitized


def get_project_name_from_db(db, project_id: UUID) -> Optional[str]:
    """Получить название проекта из БД"""
    try:
        # Пока используем заглушку - в будущем добавим таблицу projects
        # from app.models.project import Project
        # project = db.query(Project).filter(Project.id == project_id).first()
        # return project.name if project else None
        return None
    except Exception:
        return None


def get_version_name_from_db(db, version_id: UUID) -> Optional[str]:
    """Получить название версии из БД"""
    try:
        # Пока используем заглушку - в будущем добавим таблицу project_versions
        # from app.models.project import ProjectVersion
        # version = db.query(ProjectVersion).filter(ProjectVersion.id == version_id).first()
        # return version.name if version else None
        return None
    except Exception:
        return None


def extract_names_from_storage_path(storage_path: str) -> tuple[Optional[str], Optional[str]]:
    """
    Извлечь названия проекта и версии из storage_path
    
    Args:
        storage_path: Путь вида "local://projects/{project_name}/versions/{version_name}/uploads/..."
    
    Returns:
        Tuple (project_name, version_name) или (None, None) если не удалось извлечь
    """
    try:
        # Убираем префиксы
        clean_path = storage_path
        if clean_path.startswith("local://"):
            clean_path = clean_path[8:]
        elif clean_path.startswith("minio://"):
            # Извлекаем путь после minio://bucket/
            parts = clean_path.split("/", 2)
            if len(parts) > 2:
                clean_path = parts[2]
        
        # Разбираем путь: projects/{project_name}/versions/{version_name}/...
        parts = clean_path.split("/")
        
        if len(parts) >= 4 and parts[0] == "projects" and parts[2] == "versions":
            project_name = parts[1]
            version_name = parts[3]
            
            # Проверяем, что это не UUID (короткие ID начинаются с "project_" или "version_")
            if not project_name.startswith("project_"):
                # Это нормальное название, но нужно восстановить пробелы и спецсимволы
                # В sanitize_filename мы заменяли спецсимволы на _, но лучше использовать как есть
                return (project_name, version_name)
        
        return (None, None)
    except Exception:
        return (None, None)


def build_storage_path(
    project_id: UUID,
    version_id: UUID,
    filename: str,
    project_name: Optional[str] = None,
    version_name: Optional[str] = None,
    use_original_filename: bool = True,
) -> str:
    """
    Построить путь для хранения файла
    
    Args:
        project_id: ID проекта (UUID)
        version_id: ID версии (UUID)
        filename: Исходное имя файла
        project_name: Название проекта (если None, используем короткий project_id)
        version_name: Название версии (если None, используем короткий version_id)
        use_original_filename: Использовать оригинальное имя файла вместо UUID
    
    Returns:
        Путь в формате: projects/{name}/versions/{name}/uploads/{filename}
    """
    # Используем названия или короткие ID
    if project_name:
        project_path = sanitize_filename(project_name)
    else:
        # Если названия нет, используем короткий ID (первые 8 символов UUID)
        project_path = f"project_{str(project_id).replace('-', '')[:8]}"
    
    if version_name:
        version_path = sanitize_filename(version_name)
    else:
        version_path = f"version_{str(version_id).replace('-', '')[:8]}"
    
    # Обрабатываем имя файла
    if use_original_filename:
        # Используем оригинальное имя, но безопасное
        original_name = Path(filename).stem
        extension = Path(filename).suffix
        safe_filename = sanitize_filename(original_name)
        
        # Добавляем короткий ID для уникальности (на случай одинаковых имен)
        file_id = str(project_id).replace('-', '')[:8]
        final_filename = f"{safe_filename}_{file_id}{extension}" if safe_filename else f"{file_id}{extension}"
    else:
        # Используем UUID (как было раньше)
        from uuid import uuid4
        file_id = str(uuid4())
        extension = Path(filename).suffix
        final_filename = f"{file_id}{extension}"
    
    return f"projects/{project_path}/versions/{version_path}/uploads/{final_filename}"

