-- BudgetWise Database Schema for MariaDB
-- Run this SQL to create all required tables

-- Plaid Connections (stores bank connections)
CREATE TABLE IF NOT EXISTS plaid_connections (
    id VARCHAR(50) PRIMARY KEY,
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
    INDEX idx_environment (plaid_environment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounts (bank accounts synced from Plaid)
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(50) PRIMARY KEY,
    plaid_account_id VARCHAR(100),
    plaid_connection_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    official_name VARCHAR(255),
    type ENUM('checking', 'savings', 'credit', 'investment', 'other') NOT NULL,
    subtype VARCHAR(100),
    current_balance DECIMAL(15, 2) DEFAULT 0,
    available_balance DECIMAL(15, 2),
    currency VARCHAR(3) DEFAULT 'CAD',
    institution_name VARCHAR(255),
    last_synced DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_plaid_account (plaid_account_id),
    INDEX idx_connection (plaid_connection_id),
    INDEX idx_type (type),
    FOREIGN KEY (plaid_connection_id) REFERENCES plaid_connections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories (transaction categories)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    icon VARCHAR(50),
    parent_id VARCHAR(50),
    is_income BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_income (is_income),
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
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
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_plaid_transaction (plaid_transaction_id),
    INDEX idx_account (account_id),
    INDEX idx_category (category_id),
    INDEX idx_date (date),
    INDEX idx_pending (pending),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    period ENUM('weekly', 'monthly', 'yearly') DEFAULT 'monthly',
    start_date DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category_id),
    INDEX idx_period (period),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default categories
INSERT IGNORE INTO categories (id, name, color, is_income) VALUES
('cat_income', 'Income', '#10b981', TRUE),
('cat_groceries', 'Groceries', '#f59e0b', FALSE),
('cat_transport', 'Transportation', '#3b82f6', FALSE),
('cat_utilities', 'Utilities', '#8b5cf6', FALSE),
('cat_entertainment', 'Entertainment', '#ec4899', FALSE),
('cat_dining', 'Dining Out', '#ef4444', FALSE),
('cat_shopping', 'Shopping', '#14b8a6', FALSE),
('cat_health', 'Health', '#f97316', FALSE),
('cat_housing', 'Housing', '#6366f1', FALSE),
('cat_other', 'Other', '#6b7280', FALSE);

-- ============================================================
-- MIGRATION: Run this if you already have the old schema
-- ============================================================
-- ALTER TABLE plaid_connections 
--   ADD COLUMN plaid_environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox' AFTER status,
--   ADD INDEX idx_environment (plaid_environment);
