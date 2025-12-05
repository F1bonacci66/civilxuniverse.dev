-- Миграция существующих данных
-- Деактивируем все существующие активации продуктов

-- Обновляем статус всех активированных продуктов на 'ready'
UPDATE user_products 
SET activation_status = 'ready' 
WHERE activation_status = 'active';

-- Создаем записи в новой таблице для всех продуктов пользователей
-- Считаем их неактивированными для всех версий Revit
INSERT INTO product_activations (user_id, product_id, revit_version, product_version, activation_status, activated_at)
SELECT 
    up.user_id,
    up.id as product_id,  -- Используем id как product_id
    '2023' as revit_version,
    '1.0' as product_version,  -- По умолчанию версия 1.0
    'inactive' as activation_status,  -- Деактивируем все существующие
    NOW() as activated_at
FROM user_products up
WHERE up.plugin_group NOT IN ('settings', 'authorization')  -- Исключаем плагин настроек
AND NOT EXISTS (
    SELECT 1 FROM product_activations pa 
    WHERE pa.user_id = up.user_id 
    AND pa.product_id = up.id 
    AND pa.revit_version = '2023'
);

-- Логируем количество мигрированных записей
SELECT 
    COUNT(*) as migrated_records,
    'Migration completed: All existing activations deactivated and migrated to new system' as message;
