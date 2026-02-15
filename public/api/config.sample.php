<?php
/**
 * BudgetWise Configuration File
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file and rename it to 'config.php' in the same directory
 * 2. Fill in your credentials below
 * 3. Make sure config.php is NOT committed to version control
 * 4. Set file permissions to 600 (readable only by owner)
 * 
 * SECURITY: Never expose this file publicly or commit it to git!
 */

return [
    // ============ Database Configuration ============
    'database' => [
        'host'     => 'localhost',           // Your MariaDB host
        'port'     => 3306,                  // Default MariaDB port
        'name'     => 'budgetwise',          // Your database name
        'user'     => 'your_db_user',        // Database username
        'password' => 'your_db_password',    // Database password
        'charset'  => 'utf8mb4',
    ],

    // ============ Plaid Configuration ============
    // Get these from https://dashboard.plaid.com/developers/keys
    // Separate credentials for sandbox and production environments
    'plaid' => [
        'sandbox' => [
            'client_id'     => 'your_sandbox_client_id',
            'secret'        => 'your_sandbox_secret_key',
            'country_codes' => ['CA'],
            'products'      => ['transactions'],
        ],
        'production' => [
            'client_id'     => 'your_production_client_id',
            'secret'        => 'your_production_secret_key',
            'country_codes' => ['CA'],
            'products'      => ['transactions'],
        ],
    ],

    // ============ Application Settings ============
    'app' => [
        'debug_mode'    => false,    // Enable detailed error messages
        'allowed_origins' => [       // CORS allowed origins
            'http://localhost:5173',
            'http://localhost:8080',
            'https://yourdomain.com',
        ],
    ],
];
