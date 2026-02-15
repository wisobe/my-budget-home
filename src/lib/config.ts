/**
 * Application Configuration
 */

// Base path for subdirectory deployment (e.g. '/budgetwise')
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/';

// API base URL - set in .env as VITE_API_URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${BASE_PATH === '/' ? '' : BASE_PATH}/api`;
