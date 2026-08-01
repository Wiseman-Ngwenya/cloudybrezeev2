// ============================================================
// CloudyBreeze E-Commerce System
// Authentication Service
// ============================================================
// Handles admin authentication via Supabase Auth.
//
// Responsibilities:
// - Admin login (email/password)
// - Admin logout (session invalidation)
// - Token verification and refresh
// - Profile retrieval
// ============================================================

const { authClient, serviceClient } = require('../config/supabase');
const {
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    InternalServerError,
} = require('../middleware/errorHandler');

// ============================================================
// Login
// ============================================================

/**
 * Authenticate an admin user with email and password.
 *
 * Flow:
 * 1. Sign in via Supabase Auth
 * 2. Verify user exists in profiles table
 * 3. Verify user has admin role and is active
 * 4. Return access token and user info
 *
 * @param {string} email - Admin email address
 * @param {string} password - Admin password
 * @returns {Promise<Object>} Auth data with access token and user profile
 * @throws {UnauthorizedError} If credentials are invalid
 * @throws {ForbiddenError} If user is not an active admin
 */
async function login(email, password) {
    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email,
        password,
    });

    if (authError) {
        // Map Supabase Auth errors to application errors
        if (
            authError.message &&
            (authError.message.includes('Invalid login credentials') ||
                authError.message.includes('invalid'))
        ) {
            throw new UnauthorizedError('Invalid email or password. Please try again.');
        }

        if (authError.message && authError.message.includes('Email not confirmed')) {
            throw new UnauthorizedError(
                'Email address has not been confirmed. Please verify your email before logging in.'
            );
        }

        console.error('Supabase Auth login error:', authError);
        throw new UnauthorizedError('Authentication failed. Please try again.');
    }

    if (!authData || !authData.user || !authData.session) {
        throw new UnauthorizedError('Authentication failed. No user data returned.');
    }

    const supabaseUser = authData.user;

    // Verify user profile exists and is an active admin
    const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, email, full_name, role, active, created_at')
        .eq('id', supabaseUser.id)
        .single();

    if (profileError || !profile) {
        // If no profile exists but auth succeeded, the user hasn't been set up
        await authClient.auth.signOut();
        throw new ForbiddenError(
            'Your account has not been configured for admin access. Please contact the system administrator.'
        );
    }

    if (!profile.active) {
        await authClient.auth.signOut();
        throw new ForbiddenError(
            'Your account has been deactivated. Please contact the system administrator.'
        );
    }

    if (profile.role !== 'admin') {
        await authClient.auth.signOut();
        throw new ForbiddenError(
            'Admin access required. You do not have the necessary permissions.'
        );
    }

    // Return auth data and profile
    return {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        user: {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role,
            active: profile.active,
            createdAt: profile.created_at,
        },
    };
}

// ============================================================
// Logout
// ============================================================

/**
 * Sign out the current admin user.
 * Invalidates the Supabase Auth session.
 *
 * @param {string} accessToken - Current access token
 * @returns {Promise<Object>} Logout confirmation
 */
async function logout(accessToken) {
    if (!accessToken) {
        return { loggedOut: true, message: 'No active session found.' };
    }

    // Set the auth session for sign out
    const { data: sessionData, error: sessionError } = await authClient.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // Refresh token not available at logout time
    });

    if (sessionError) {
        // If we can't set the session, the token may already be invalid
        // Still consider this a successful logout
        return { loggedOut: true, message: 'Session cleared.' };
    }

    const { error: signOutError } = await authClient.auth.signOut();

    if (signOutError) {
        console.error('Supabase Auth sign out error:', signOutError);
        // Consider logout successful even if Supabase sign out fails
    }

    return { loggedOut: true, message: 'Successfully logged out.' };
}

// ============================================================
// Get Current User
// ============================================================

/**
 * Get the currently authenticated admin user's profile.
 *
 * @param {Object} user - User object from auth middleware (req.user)
 * @returns {Promise<Object>} User profile
 * @throws {NotFoundError} If profile not found
 */
async function getCurrentUser(user) {
    if (!user || !user.id) {
        throw new UnauthorizedError('Not authenticated.');
    }

    const { data: profile, error } = await serviceClient
        .from('profiles')
        .select('id, email, full_name, role, active, created_at, updated_at')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        throw new NotFoundError('User profile not found.');
    }

    return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        active: profile.active,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
    };
}

// ============================================================
// Verify Token
// ============================================================

/**
 * Verify a Supabase access token is valid.
 * Used for checking token validity without full auth middleware.
 *
 * @param {string} accessToken - Supabase access token
 * @returns {Promise<Object>} User info from the token
 * @throws {UnauthorizedError} If token is invalid
 */
async function verifyToken(accessToken) {
    if (!accessToken) {
        throw new UnauthorizedError('Access token is required.');
    }

    const { data, error } = await authClient.auth.getUser(accessToken);

    if (error) {
        if (error.message && error.message.includes('expired')) {
            throw new UnauthorizedError('Access token has expired. Please log in again.');
        }
        throw new UnauthorizedError('Invalid access token.');
    }

    if (!data || !data.user) {
        throw new UnauthorizedError('Unable to verify user identity.');
    }

    // Verify the user has an active admin profile
    const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, email, full_name, role, active')
        .eq('id', data.user.id)
        .single();

    if (profileError || !profile) {
        throw new ForbiddenError('Admin profile not found.');
    }

    if (!profile.active || profile.role !== 'admin') {
        throw new ForbiddenError('Admin access required.');
    }

    return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        active: profile.active,
    };
}

// ============================================================
// Refresh Token
// ============================================================

/**
 * Refresh an expired or expiring access token.
 *
 * @param {string} refreshToken - Supabase refresh token
 * @returns {Promise<Object>} New session data
 * @throws {UnauthorizedError} If refresh token is invalid
 */
async function refreshSession(refreshToken) {
    if (!refreshToken) {
        throw new UnauthorizedError('Refresh token is required.');
    }

    const { data, error } = await authClient.auth.refreshSession({
        refresh_token: refreshToken,
    });

    if (error) {
        console.error('Supabase Auth refresh error:', error);
        throw new UnauthorizedError(
            'Session refresh failed. Please log in again.'
        );
    }

    if (!data || !data.session) {
        throw new UnauthorizedError('Unable to refresh session.');
    }

    return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
    };
}

// ============================================================
// Export
// ============================================================
module.exports = {
    login,
    logout,
    getCurrentUser,
    verifyToken,
    refreshSession,
};