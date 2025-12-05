-- Создание таблиц projects и project_versions для CivilX.Universe

-- Таблица projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id BIGSERIAL NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_by UUID NOT NULL,
    company_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    
    -- Внешние ключи (закомментированы, если таблицы users и companies еще не созданы)
    -- CONSTRAINT fk_projects_created_by 
    --     FOREIGN KEY (created_by) 
    --     REFERENCES users(id) 
    --     ON DELETE SET NULL,
    -- CONSTRAINT fk_projects_company_id 
    --     FOREIGN KEY (company_id) 
    --     REFERENCES companies(id) 
    --     ON DELETE SET NULL
);

-- Индексы для projects
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_short_id ON projects(short_id);

-- Таблица project_versions (если еще не создана)
CREATE TABLE IF NOT EXISTS project_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id BIGSERIAL NOT NULL UNIQUE,
    project_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Уникальность slug в рамках проекта
    CONSTRAINT unique_project_version_slug UNIQUE (project_id, slug)
    
    -- Внешние ключи (закомментированы, если таблицы еще не созданы)
    -- CONSTRAINT fk_project_versions_project 
    --     FOREIGN KEY (project_id) 
    --     REFERENCES projects(id) 
    --     ON DELETE CASCADE,
    -- CONSTRAINT fk_project_versions_created_by 
    --     FOREIGN KEY (created_by) 
    --     REFERENCES users(id) 
    --     ON DELETE SET NULL
);

-- Индексы для project_versions
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_by ON project_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON project_versions(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_short_id ON project_versions(short_id);

-- Комментарии для документации
COMMENT ON TABLE projects IS 'Проекты пользователей';
COMMENT ON TABLE project_versions IS 'Версии проектов - снимки проекта на определённый момент времени';

