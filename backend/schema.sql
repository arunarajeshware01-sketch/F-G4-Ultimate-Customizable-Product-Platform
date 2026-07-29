-- ============================================================================
-- VaultKeep - Digital Warranty & Service Book
-- MySQL Database Schema (Indian Rupee ₹ INR Standard)
-- Document Version: 1.0 (SRS Compliant for XAMPP / MariaDB)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `vaultkeep_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `vaultkeep_db`;

-- ----------------------------------------------------------------------------
-- Table: users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') DEFAULT 'user',
  `status` ENUM('Active', 'Suspended') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table: categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `category_id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_name` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table: products
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `product_id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `category_id` INT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `brand` VARCHAR(100) NOT NULL,
  `serial_number` VARCHAR(100) DEFAULT NULL,
  `purchase_date` DATE NOT NULL,
  `warranty_period_months` INT NOT NULL DEFAULT 12,
  `expiry_date` DATE NOT NULL,
  `price_inr` DECIMAL(10, 2) DEFAULT 0.00,
  `bill_path` VARCHAR(255) DEFAULT NULL,
  `qr_code_path` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table: service_histories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_histories` (
  `service_id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `service_date` DATE NOT NULL,
  `provider_name` VARCHAR(150) NOT NULL,
  `cost_inr` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `receipt_path` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table: system_settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(50) PRIMARY KEY,
  `setting_value` VARCHAR(255) NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Seed Categories
-- ----------------------------------------------------------------------------
INSERT INTO `categories` (`category_id`, `category_name`) VALUES 
(1, 'Laptops & Computers'),
(2, 'Mobile Devices'),
(3, 'Home Appliances'),
(4, 'Smart Wearables'),
(5, 'Audio & Entertainment')
ON DUPLICATE KEY UPDATE `category_name`=`category_name`;

-- ----------------------------------------------------------------------------
-- Seed Default Users (Passwords hashed using BCrypt: "User@123" and "Admin@123")
-- ----------------------------------------------------------------------------
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password`, `role`, `status`) VALUES
(1, 'Alex Morgan', 'alex.m@vaultkeep.io', '$2y$10$n8PKSu1N5xRc3cgFezMt3u4I9dW2eRw7XGwqt02VsJJdPBKGR6n9e', 'user', 'Active'),
(2, 'System Admin', 'admin@vaultkeep.io', '$2y$10$xckMy2UsJgQ1ACvCBxwSH.5LufxwcVznLgdWkpna6VtXBQh5/LQU.', 'admin', 'Active')
ON DUPLICATE KEY UPDATE `email`=`email`;

-- ----------------------------------------------------------------------------
-- Seed Products with Indian Rupee (₹) Pricing
-- ----------------------------------------------------------------------------
INSERT INTO `products` (`product_id`, `user_id`, `category_id`, `product_name`, `brand`, `serial_number`, `purchase_date`, `warranty_period_months`, `expiry_date`, `price_inr`, `bill_path`, `notes`) VALUES
(101, 1, 1, 'MacBook Pro 16" M3 Max', 'Apple', 'C02G8492Q6LR', '2025-11-15', 24, '2027-11-15', 249900.00, 'uploads/bills/Apple_MBP16_Invoice.pdf', 'Includes AppleCare+ coverage with 2 years validity.'),
(102, 1, 2, 'Galaxy S24 Ultra 512GB', 'Samsung', 'R5CR309K98Z', '2025-08-01', 12, '2026-08-01', 139999.00, 'uploads/bills/Samsung_S24_Bill.jpg', 'Purchased with screen replacement guarantee.'),
(103, 1, 3, 'LG OLED 65" C3 4K Smart TV', 'LG Electronics', '304RMKB92104', '2024-03-10', 24, '2026-03-10', 164990.00, 'uploads/bills/LG_OLED_Invoice.pdf', 'Panel 2-year official manufacturer warranty.'),
(104, 1, 5, 'Sony WH-1000XM5 ANC Headphones', 'Sony', 'S01-9821450-H', '2025-12-20', 12, '2026-12-20', 29990.00, 'uploads/bills/Sony_Headphones_Receipt.png', 'Official Sony India warranty card registered.'),
(105, 1, 3, 'Dyson V15 Detect Vacuum Cleaner', 'Dyson', 'DY-9281-V15', '2025-07-28', 12, '2026-07-28', 65900.00, 'uploads/bills/Dyson_Invoice.pdf', 'Battery covered for 12 months.')
ON DUPLICATE KEY UPDATE `product_name`=`product_name`;

-- ----------------------------------------------------------------------------
-- Seed Service Histories in INR (₹)
-- ----------------------------------------------------------------------------
INSERT INTO `service_histories` (`service_id`, `product_id`, `service_date`, `provider_name`, `cost_inr`, `description`) VALUES
(201, 102, '2026-02-14', 'Samsung Authorized Care Center', 3500.00, 'USB-C charging port cleaning & original cable check.'),
(202, 103, '2025-05-20', 'LG Service India Center', 8500.00, 'Power supply board replacement under extended warranty.')
ON DUPLICATE KEY UPDATE `provider_name`=`provider_name`;
