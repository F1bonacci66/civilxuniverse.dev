-- Миграция для создания таблицы universe_users
-- Выполнить в PostgreSQL базе данных

CREATE TABLE IF NOT EXISTS universe_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_universe_users_email ON universe_users(email);
CREATE INDEX IF NOT EXISTS idx_universe_users_id ON universe_users(id);

-- Комментарии к таблице
COMMENT ON TABLE universe_users IS 'Пользователи Universe - обособленная система авторизации';
COMMENT ON COLUMN universe_users.id IS 'UUID пользователя';
COMMENT ON COLUMN universe_users.email IS 'Email пользователя (уникальный)';
COMMENT ON COLUMN universe_users.password_hash IS 'Хеш пароля (bcrypt)';
COMMENT ON COLUMN universe_users.name IS 'Имя пользователя';
COMMENT ON COLUMN universe_users.is_active IS 'Активен ли пользователь';
COMMENT ON COLUMN universe_users.is_verified IS 'Верифицирован ли email';
COMMENT ON COLUMN universe_users.created_at IS 'Дата создания';
COMMENT ON COLUMN universe_users.updated_at IS 'Дата последнего обновления';

