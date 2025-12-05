-- Создание таблицы для отслеживания активации продуктов по версиям Revit
CREATE TABLE IF NOT EXISTS product_activations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    revit_version VARCHAR(20) NOT NULL,
    product_version VARCHAR(20) NOT NULL,
    activation_status ENUM('active', 'inactive') DEFAULT 'active',
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES user_products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product_revit (user_id, product_id, revit_version)
);

-- Индекс для быстрого поиска активаций пользователя
CREATE INDEX idx_user_activations ON product_activations(user_id, activation_status);

-- Индекс для поиска по продукту и версии Revit
CREATE INDEX idx_product_revit ON product_activations(product_id, revit_version);
