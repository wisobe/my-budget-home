-- BudgetWise Database Schema for MariaDB
-- Run this SQL to create all required tables

-- Users table (multi-user auth)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    totp_secret VARCHAR(64) DEFAULT NULL,
    totp_enabled BOOLEAN DEFAULT FALSE,
    recovery_codes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auth Tokens (session tokens for login)
CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    is_2fa_pending BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX idx_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Plaid Connections (stores bank connections)
CREATE TABLE IF NOT EXISTS plaid_connections (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    institution_id VARCHAR(100) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    access_token_encrypted TEXT,
    item_id VARCHAR(100),
    sync_cursor TEXT,
    status ENUM('active', 'error', 'pending') DEFAULT 'pending',
    plaid_environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox',
    error_message TEXT,
    last_synced DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_institution (institution_id),
    INDEX idx_environment (plaid_environment),
    INDEX idx_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounts (bank accounts synced from Plaid)
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    plaid_account_id VARCHAR(100),
    plaid_connection_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    official_name VARCHAR(255),
    type ENUM('checking', 'savings', 'credit', 'investment', 'depository', 'loan', 'other') NOT NULL,
    subtype VARCHAR(100),
    current_balance DECIMAL(15, 2) DEFAULT 0,
    available_balance DECIMAL(15, 2),
    currency VARCHAR(3) DEFAULT 'CAD',
    institution_name VARCHAR(255),
    excluded BOOLEAN DEFAULT FALSE,
    last_synced DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_plaid_account (plaid_account_id),
    INDEX idx_connection (plaid_connection_id),
    INDEX idx_type (type),
    INDEX idx_user (user_id),
    INDEX idx_excluded (excluded),
    FOREIGN KEY (plaid_connection_id) REFERENCES plaid_connections(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories (transaction categories - per user)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    icon VARCHAR(50),
    parent_id VARCHAR(50),
    is_income BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_income (is_income),
    INDEX idx_user (user_id),
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    plaid_transaction_id VARCHAR(100),
    account_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    merchant_name VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    category_id VARCHAR(50),
    pending BOOLEAN DEFAULT FALSE,
    excluded BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_plaid_transaction (plaid_transaction_id),
    INDEX idx_account (account_id),
    INDEX idx_category (category_id),
    INDEX idx_date (date),
    INDEX idx_pending (pending),
    INDEX idx_excluded (excluded),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transaction Splits (for splitting a transaction across categories)
CREATE TABLE IF NOT EXISTS transaction_splits (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    category_id VARCHAR(50),
    amount DECIMAL(15, 2) NOT NULL,
    is_excluded BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_transaction (transaction_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    period ENUM('weekly', 'monthly', 'yearly') DEFAULT 'monthly',
    plaid_environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_category_period_env (user_id, category_id, period, plaid_environment),
    INDEX idx_category (category_id),
    INDEX idx_period (period),
    INDEX idx_user (user_id),
    INDEX idx_environment (plaid_environment),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Category Rules (for auto-categorization by keyword matching)
CREATE TABLE IF NOT EXISTS category_rules (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    match_type ENUM('contains', 'exact', 'starts_with') DEFAULT 'contains',
    priority INT DEFAULT 0,
    auto_learned BOOLEAN DEFAULT FALSE,
    plaid_environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_keyword (keyword),
    INDEX idx_category (category_id),
    INDEX idx_priority (priority),
    INDEX idx_user (user_id),
    INDEX idx_environment (plaid_environment),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Application Settings (key-value store for admin-configurable settings)
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default categories are now seeded per-user on first login (see categories/index.php)
-- No global INSERT needed.

-- ============================================================
-- MIGRATION: Run this if you already have the old single-user schema
-- ============================================================
-- Step 1: Create users table
-- CREATE TABLE IF NOT EXISTS users (
--     id VARCHAR(50) PRIMARY KEY,
--     email VARCHAR(255) NOT NULL UNIQUE,
--     name VARCHAR(255) NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
--     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     INDEX idx_email (email),
--     INDEX idx_role (role)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
-- Step 2: Create your admin user (replace email/password hash)
-- INSERT INTO users (id, email, name, password_hash, role) VALUES
-- ('user_admin', 'admin@example.com', 'Admin', '$2y$10$YOUR_BCRYPT_HASH', 'admin');
--
-- Step 3: Add user_id columns
-- ALTER TABLE auth_tokens ADD COLUMN user_id VARCHAR(50) NOT NULL DEFAULT 'user_admin';
-- ALTER TABLE auth_tokens ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- ALTER TABLE plaid_connections ADD COLUMN user_id VARCHAR(50) NOT NULL DEFAULT 'user_admin';
-- ALTER TABLE plaid_connections ADD INDEX idx_user (user_id);
-- ALTER TABLE plaid_connections ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- ALTER TABLE accounts ADD COLUMN user_id VARCHAR(50) NOT NULL DEFAULT 'user_admin';
-- ALTER TABLE accounts ADD INDEX idx_user (user_id);
-- ALTER TABLE accounts ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- ALTER TABLE category_rules ADD COLUMN user_id VARCHAR(50) NOT NULL DEFAULT 'user_admin';
-- ALTER TABLE category_rules ADD INDEX idx_user (user_id);
-- ALTER TABLE category_rules ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- Step 4: Clean up old app_settings password (optional)
-- DELETE FROM app_settings WHERE setting_key = 'password_hash';
