-- Добавление поля company_name в таблицу universe_users
-- Выполнить на сервере: psql -U postgres -d civilx_db -f add_company_name_to_universe_users.sql

ALTER TABLE universe_users 
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) NULL;

-- Комментарий к колонке
COMMENT ON COLUMN universe_users.company_name IS 'Название компании пользователя (необязательное поле)';

