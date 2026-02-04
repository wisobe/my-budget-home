# BudgetWise Self-Hosted Deployment Guide

This guide walks you through deploying BudgetWise on your own Apache + MariaDB server.

## Prerequisites

- ✅ Apache web server with mod_rewrite enabled
- ✅ PHP 7.4+ with PDO and cURL extensions
- ✅ MariaDB/MySQL database
- ✅ Node.js 18+ (for building the frontend)
- ✅ Domain pointing to your server

---

## Step 1: Verify PHP Requirements

SSH into your server and check PHP modules:

```bash
php -m | grep -E 'pdo|curl|json'
```

You should see:
- `curl`
- `json`
- `pdo_mysql`

If missing, install them:
```bash
# Debian/Ubuntu
sudo apt install php-mysql php-curl php-json

# Then restart Apache
sudo systemctl restart apache2
```

---

## Step 2: Create the Database

Connect to MariaDB:

```bash
mysql -u root -p
```

Create database and user:

```sql
-- Create the database
CREATE DATABASE budgetwise CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user (replace 'your_password' with a strong password)
CREATE USER 'budgetwise_user'@'localhost' IDENTIFIED BY 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON budgetwise.* TO 'budgetwise_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

---

## Step 3: Import the Database Schema

Navigate to your project's API folder and import the schema:

```bash
mysql -u budgetwise_user -p budgetwise < /path/to/your/project/public/api/schema.sql
```

Verify tables were created:

```bash
mysql -u budgetwise_user -p budgetwise -e "SHOW TABLES;"
```

You should see:
- accounts
- budgets
- categories
- plaid_connections
- transactions

---

## Step 4: Create the PHP Configuration File

Navigate to your API directory:

```bash
cd /var/www/your-domain/public/api/
```

Copy the sample config:

```bash
cp config.sample.php config.php
```

Edit the config file:

```bash
nano config.php
```

Update these values:

```php
return [
    'database' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'name'     => 'budgetwise',
        'user'     => 'budgetwise_user',        // Your DB user
        'password' => 'your_password',          // Your DB password
        'charset'  => 'utf8mb4',
    ],

    'plaid' => [
        'client_id'   => 'your_plaid_client_id',   // From Plaid Dashboard
        'secret'      => 'your_plaid_secret_key',  // From Plaid Dashboard
        'environment' => 'sandbox',                 // Start with sandbox
        'country_codes' => ['CA'],
        'products'    => ['transactions'],
    ],

    'app' => [
        'use_mock_data' => false,    // Set to FALSE for real data
        'debug_mode'    => true,     // Set TRUE temporarily for debugging
        'allowed_origins' => [
            'https://your-domain.com',
            'https://www.your-domain.com',
        ],
    ],
];
```

Secure the config file:

```bash
chmod 640 config.php
chown www-data:www-data config.php
```

---

## Step 5: Build the React Frontend

On your **local machine** (or on the server if Node.js is installed):

### Option A: Build Locally and Upload

1. Clone/download the project locally
2. Create a `.env` file in the project root:

```bash
VITE_API_URL=/api
```

3. Update `src/lib/config.ts`:

```typescript
export const USE_MOCK_DATA = false;  // Change to false
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const PLAID_ENV = 'sandbox';
```

4. Build the project:

```bash
npm install
npm run build
```

5. Upload the `dist/` folder contents to your server's web root

### Option B: Build on Server

```bash
cd /var/www/your-domain
npm install
npm run build
```

---

## Step 6: Configure Directory Structure

Your web root should look like this:

```
/var/www/your-domain/
├── index.html          ← From dist/ folder
├── assets/             ← From dist/ folder
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── api/                ← PHP backend
    ├── config.php      ← Your config (NOT config.sample.php)
    ├── config.sample.php
    ├── schema.sql
    ├── includes/
    │   ├── bootstrap.php
    │   ├── Database.php
    │   ├── PlaidClient.php
    │   └── Response.php
    ├── accounts/
    │   └── index.php
    ├── categories/
    │   ├── index.php
    │   └── delete.php
    ├── plaid/
    │   ├── link-token.php
    │   ├── exchange-token.php
    │   ├── connections.php
    │   ├── sync.php
    │   └── remove.php
    ├── settings/
    │   ├── index.php
    │   └── test-db.php
    └── transactions/
        ├── index.php
        └── categorize.php
```

**Important**: The `dist/` contents go in the web root, and `public/api/` becomes just `api/`.

---

## Step 7: Configure Apache Virtual Host

Create or edit your Apache config:

```bash
sudo nano /etc/apache2/sites-available/your-domain.conf
```

Add this configuration:

```apache
<VirtualHost *:443>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    DocumentRoot /var/www/your-domain

    # Enable mod_rewrite
    <Directory /var/www/your-domain>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # Handle React Router (SPA)
        RewriteEngine On
        
        # Don't rewrite files or directories
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        
        # Don't rewrite API requests
        RewriteCond %{REQUEST_URI} !^/api/
        
        # Rewrite everything else to index.html
        RewriteRule ^ index.html [L]
    </Directory>

    # PHP settings for API
    <Directory /var/www/your-domain/api>
        Options -Indexes
        AllowOverride None
        Require all granted
        
        # Process PHP files
        <FilesMatch \.php$>
            SetHandler application/x-httpd-php
        </FilesMatch>
    </Directory>

    # Protect config file
    <Files "config.php">
        Require all denied
    </Files>

    # SSL Configuration (adjust paths to your certificates)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem

    ErrorLog ${APACHE_LOG_DIR}/budgetwise_error.log
    CustomLog ${APACHE_LOG_DIR}/budgetwise_access.log combined
</VirtualHost>

# Redirect HTTP to HTTPS
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>
```

Enable the site and required modules:

```bash
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2ensite your-domain.conf
sudo apache2ctl configtest
sudo systemctl restart apache2
```

---

## Step 8: Alternative - Use .htaccess

If you can't edit Apache config, create `.htaccess` in your web root:

```bash
nano /var/www/your-domain/.htaccess
```

```apache
# Enable rewrite engine
RewriteEngine On

# Handle React Router
# If the request is not for a file
RewriteCond %{REQUEST_FILENAME} !-f
# And not for a directory
RewriteCond %{REQUEST_FILENAME} !-d
# And not for the API
RewriteCond %{REQUEST_URI} !^/api/
# Send it to index.html
RewriteRule ^ index.html [L]

# Security: Deny access to config files
<FilesMatch "(config\.php|\.env|\.git)">
    Require all denied
</FilesMatch>

# Security: Disable directory listing
Options -Indexes
```

---

## Step 9: Set Final Permissions

```bash
cd /var/www/your-domain

# Set ownership
sudo chown -R www-data:www-data .

# Set directory permissions
sudo find . -type d -exec chmod 750 {} \;

# Set file permissions
sudo find . -type f -exec chmod 640 {} \;

# Make sure PHP files are readable
sudo chmod 640 api/includes/*.php
sudo chmod 640 api/*/*.php

# Extra protection for config
sudo chmod 600 api/config.php
```

---

## Step 10: Test Your Setup

### Test 1: PHP is Working

Visit: `https://your-domain.com/api/settings/index.php`

You should see JSON like:
```json
{
  "success": true,
  "data": {
    "use_mock_data": false,
    "plaid_environment": "sandbox",
    ...
  }
}
```

**If you see a 500 error**, check Apache logs:
```bash
sudo tail -50 /var/log/apache2/budgetwise_error.log
```

### Test 2: Database Connection

Visit: `https://your-domain.com/api/settings/test-db.php` (POST request)

Or use curl:
```bash
curl -X POST https://your-domain.com/api/settings/test-db.php
```

Expected response:
```json
{
  "success": true,
  "data": {
    "success": true,
    "version": "10.x.x-MariaDB",
    "message": "Connection successful"
  }
}
```

### Test 3: Frontend Loads

Visit: `https://your-domain.com/`

You should see the BudgetWise dashboard.

### Test 4: API Communication

Open browser DevTools (F12) → Network tab → Refresh the page.

Look for requests to `/api/` endpoints. They should return `200 OK`.

---

## Troubleshooting

### Problem: 500 Internal Server Error

1. Check Apache error logs:
   ```bash
   sudo tail -100 /var/log/apache2/error.log
   ```

2. Enable PHP error display temporarily:
   ```bash
   sudo nano /etc/php/8.1/apache2/php.ini
   # Set: display_errors = On
   sudo systemctl restart apache2
   ```

### Problem: 404 on Page Refresh

The React Router rewrite isn't working. Verify:
1. `mod_rewrite` is enabled: `sudo a2enmod rewrite`
2. `AllowOverride All` is set in Apache config
3. `.htaccess` file exists and has correct rules

### Problem: CORS Errors

Check that your domain is in `config.php` allowed_origins:
```php
'allowed_origins' => [
    'https://your-domain.com',
    'https://www.your-domain.com',
],
```

### Problem: "Configuration file not found"

The `config.php` file doesn't exist or isn't readable:
```bash
ls -la /var/www/your-domain/api/config.php
# Should show: -rw------- www-data www-data config.php
```

### Problem: Database Connection Failed

1. Verify MySQL user can connect:
   ```bash
   mysql -u budgetwise_user -p budgetwise -e "SELECT 1"
   ```

2. Check if using correct socket/host in config.php

3. For remote database, ensure the user has remote access:
   ```sql
   CREATE USER 'budgetwise_user'@'%' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON budgetwise.* TO 'budgetwise_user'@'%';
   ```

### Problem: Blank White Page

1. Check browser console (F12) for JavaScript errors
2. Verify `dist/assets/` files were uploaded
3. Check that `index.html` references correct asset paths

---

## Quick Checklist

- [ ] PHP 7.4+ with pdo_mysql, curl, json
- [ ] MariaDB database created
- [ ] Schema imported (5 tables)
- [ ] `config.php` created with correct credentials
- [ ] `USE_MOCK_DATA = false` in frontend config
- [ ] Frontend built with `npm run build`
- [ ] `dist/` contents uploaded to web root
- [ ] `public/api/` uploaded as `api/`
- [ ] Apache rewrite rules configured
- [ ] Permissions set (www-data, 750/640)
- [ ] SSL certificate configured
- [ ] API endpoints return JSON
- [ ] Frontend loads without errors

---

## Getting Plaid Credentials

1. Sign up at https://dashboard.plaid.com/
2. Get your **Client ID** and **Sandbox Secret**
3. Add them to `config.php`
4. Start with `sandbox` environment for testing
5. Apply for production access when ready

---

## Support

If you're still having issues after following this guide:

1. Share the exact error message
2. Share relevant Apache error log entries
3. Share the response from `/api/settings/test-db.php`
