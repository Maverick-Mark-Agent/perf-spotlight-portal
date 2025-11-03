/**
 * API Configuration Constants
 * 
 * All API endpoints and configuration.
 * TODO: Move sensitive keys to environment variables
 * 
 * @file src/constants/api.ts
 */

// ============= Email Bison API =============

/**
 * Email Bison API Configuration
 * TODO: Move API_KEY to VITE_EMAIL_BISON_API_KEY environment variable
 */
export const EMAIL_BISON_API = {
  BASE_URL: 'https://send.maverickmarketingllc.com/api',
  // TODO: SECURITY - Move to environment variable
  API_KEY: '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d',
} as const;

// ============= Supabase Configuration =============

/**
 * Supabase Configuration
 * TODO: Move to environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 */
export const SUPABASE_CONFIG = {
  // TODO: SECURITY - Move to environment variable
  URL: "https://gjqbbgrfhijescaouqkx.supabase.co",
  // TODO: SECURITY - Move to environment variable
  PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0",
} as const;

// ============= Map CDN URLs =============

export const MAP_CDN = {
  GEO_URL: "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
} as const;
