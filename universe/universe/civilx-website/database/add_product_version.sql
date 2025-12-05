-- Добавляем версию продукта DataHub для Revit 2023
INSERT INTO product_versions (
    product_name, 
    version, 
    revit_version, 
    file_path, 
    file_size, 
    release_date, 
    is_active, 
    description, 
    created_at
) VALUES (
    'DataHub', 
    '1.0', 
    '2023', 
    '/installer/2023/1.0/CivilX-2023-v1.0.msi', 
    0, 
    NOW(), 
    1, 
    'DataHub plugin for Revit 2023', 
    NOW()
);

-- Проверяем что запись добавилась
SELECT * FROM product_versions WHERE product_name = 'DataHub' AND revit_version = '2023';
