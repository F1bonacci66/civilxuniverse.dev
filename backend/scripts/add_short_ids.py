"""
Скрипт для добавления коротких числовых идентификаторов в таблицы projects и project_versions.
Запускается один раз при миграции существующей базы.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text

from app.core.config import settings


STATEMENTS = [
    # Projects
    "CREATE SEQUENCE IF NOT EXISTS projects_short_id_seq START 1;",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS short_id BIGINT;",
    "ALTER TABLE projects ALTER COLUMN short_id SET DEFAULT nextval('projects_short_id_seq');",
    "UPDATE projects SET short_id = nextval('projects_short_id_seq') WHERE short_id IS NULL;",
    "SELECT setval('projects_short_id_seq', COALESCE((SELECT MAX(short_id) FROM projects), 0));",
    "ALTER SEQUENCE projects_short_id_seq OWNED BY projects.short_id;",
    "ALTER TABLE projects ALTER COLUMN short_id SET NOT NULL;",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_short_id ON projects(short_id);",
    # Project versions
    "CREATE SEQUENCE IF NOT EXISTS project_versions_short_id_seq START 1;",
    "ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS short_id BIGINT;",
    "ALTER TABLE project_versions ALTER COLUMN short_id SET DEFAULT nextval('project_versions_short_id_seq');",
    "UPDATE project_versions SET short_id = nextval('project_versions_short_id_seq') WHERE short_id IS NULL;",
    "SELECT setval('project_versions_short_id_seq', COALESCE((SELECT MAX(short_id) FROM project_versions), 0));",
    "ALTER SEQUENCE project_versions_short_id_seq OWNED BY project_versions.short_id;",
    "ALTER TABLE project_versions ALTER COLUMN short_id SET NOT NULL;",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_short_id ON project_versions(short_id);",
]


def add_short_ids():
    database_url = settings.DATABASE_URL
    sanitized = database_url.split("@")[-1] if "@" in database_url else database_url
    print(f"Connecting to database: {sanitized}")
    engine = create_engine(database_url)

    with engine.connect() as connection:
        trans = connection.begin()
        try:
            for idx, statement in enumerate(STATEMENTS, 1):
                print(f"[{idx}/{len(STATEMENTS)}] Executing:\n{statement}")
                connection.execute(text(statement))
            trans.commit()
            print("✅ Short ID migration completed successfully.")
        except Exception as exc:
            trans.rollback()
            print(f"❌ Error applying migration: {exc}")
            raise


if __name__ == "__main__":
    add_short_ids()

