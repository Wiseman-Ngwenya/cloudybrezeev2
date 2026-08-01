// ============================================================
// CloudyBreeze E-Commerce System
// Supabase Client Configuration
// ============================================================
// This module initializes two Supabase clients:
//
// 1. serviceClient - Uses SERVICE_ROLE_KEY
//    Full database access, bypasses RLS
//    Used for all backend database operations
//    NEVER exposed to the frontend
//
// 2. authClient - Uses ANON_KEY
//    Used for Supabase Auth operations (admin login/verify)
//    Respects RLS policies
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Environment Variable Validation
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    console.error('ERROR: SUPABASE_URL is not defined in environment variables.');
    console.error('Please check your .env file and ensure SUPABASE_URL is set.');
    process.exit(1);
}

if (!supabaseAnonKey) {
    console.error('ERROR: SUPABASE_ANON_KEY is not defined in environment variables.');
    console.error('Please check your .env file and ensure SUPABASE_ANON_KEY is set.');
    process.exit(1);
}

if (!supabaseServiceRoleKey) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.');
    console.error('Please check your .env file and ensure SUPABASE_SERVICE_ROLE_KEY is set.');
    process.exit(1);
}


// Warn if placeholder/example values are being used.
const placeholderMarkers = [
    'your-project-id.supabase.co',
    'your-anon-key-here',
    'your-service-role-key-here',
];
const usingPlaceholderValues = placeholderMarkers.some((marker) =>
    [supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey].some(
        (value) => typeof value === 'string' && value.includes(marker)
    )
);

if (usingPlaceholderValues) {
    console.warn(
        'WARNING: Supabase environment variables are still using placeholder values from .env.example.'
    );
    console.warn(
        'Replace them with real Supabase credentials in .env or .env.local to enable database communication.'
    );
}

// ============================================================
// Supabase Client Initialization
// ============================================================

// Service Role Client - Used for all backend database operations
// This client bypasses Row Level Security
// All service layer operations use this client
const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    db: {
        schema: 'public',
    },
});

// Auth Client - Used for Supabase Auth operations only
// This client respects Row Level Security
// Used for admin authentication (login, token verification)
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: false,
    },
    db: {
        schema: 'public',
    },
});

// ============================================================
// Storage Bucket Configuration
// ============================================================
const STORAGE_BUCKET = 'product-images';

// ============================================================
// Export
// ============================================================
module.exports = {
    serviceClient,
    authClient,
    STORAGE_BUCKET,
};