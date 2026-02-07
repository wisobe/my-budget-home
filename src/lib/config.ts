/**
 * Application Configuration
 * 
 * This file centralizes configuration that can be toggled at build time.
 * For production, set USE_MOCK_DATA to false to use your real PHP backend.
 */

// Set to false to use real PHP backend
export const USE_MOCK_DATA = true;

// Base path for subdirectory deployment (e.g. '/budgetwise')
// Set via VITE_BASE_PATH env var or in .env file
// Use '/' for root deployment, '/subfolder' for subdirectory
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/';

// API base URL - set in .env as VITE_API_URL
// Defaults to BASE_PATH + 'api' so it works in subdirectories
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${BASE_PATH === '/' ? '' : BASE_PATH}/api`;

// Plaid environment (should match your server config)
export const PLAID_ENV = 'sandbox'; // 'sandbox' | 'development' | 'production'
