/**
 * Application Configuration
 * 
 * This file centralizes configuration that can be toggled at build time.
 * For production, set USE_MOCK_DATA to false to use your real PHP backend.
 */

// Set to false to use real PHP backend
export const USE_MOCK_DATA = true;

// API base URL - set in .env as VITE_API_URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Plaid environment (should match your server config)
export const PLAID_ENV = 'sandbox'; // 'sandbox' | 'development' | 'production'
