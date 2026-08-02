// ============================================================
// CloudyBreeze E-Commerce System
// Authentication Middleware
// ============================================================
// Protects admin routes by verifying Supabase Auth JWT tokens.
//
// Flow:
// 1. Extract Bearer token from Authorization header
// 2. Verify token with Supabase Auth
// 3. Check user exists in profiles table with admin role
// 4. Attach user info to req.user for downstream use
// ============================================================

const { authClient, serviceClient } = require('../config/supabase');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

// ============================================================
// Authenticate Middleware
// ============================================================

/**
 * Verify the Supabase access token from the Authorization header.
 * Attaches decoded user info to req.user if valid.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
    try {
        // Extract Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedError('Authorization header is required');
        }

        // Check for Bearer token format
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            throw new UnauthorizedError(
                'Authorization header must use Bearer scheme'
            );
        }

        const token = parts[1];

        if (!token || token === 'null' || token === 'undefined') {
            throw new UnauthorizedError('Access token is required');
        }

        // Verify token with Supabase Auth
        const { data, error } = await authClient.auth.getUser(token);

        if (error) {
            // Map Supabase Auth errors
            if (error.message && error.message.includes('expired')) {
                throw new UnauthorizedError('Access token has expired');
            }
            if (error.message && error.message.includes('invalid')) {
                throw new UnauthorizedError('Invalid access token');
            }
            throw new UnauthorizedError('Authentication failed');
        }

        if (!data || !data.user) {
            throw new UnauthorizedError('Unable to verify user identity');
        }

        const supabaseUser = data.user;

        // Verify user exists in profiles table and is an active admin.
        // Use the service role client here so this lookup is not blocked by RLS.
        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('id, email, full_name, role, active')
            .eq('id', supabaseUser.id)
            .maybeSingle();

        if (profileError) {
            console.error('Profile lookup failed during admin authentication:', profileError);
            throw new ForbiddenError('User profile not found. Admin access required.');
        }

        if (!profile) {
            throw new ForbiddenError(
                'User profile not found. Admin access required.'
            );
        }

        if (!profile.active) {
            throw new ForbiddenError(
                'Your account has been deactivated. Please contact the administrator.'
            );
        }

        if (profile.role !== 'admin') {
            throw new ForbiddenError(
                'Admin access required to access this resource'
            );
        }

        // Attach user info to request object
        req.user = {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role,
        };

        next();
    } catch (err) {
        // Pass known errors as-is, wrap unexpected errors
        if (err.statusCode) {
            next(err);
        } else {
            console.error('Unexpected authentication error:', err);
            next(new UnauthorizedError('Authentication failed due to an unexpected error'));
        }
    }
}

// ============================================================
// Optional Authenticate Middleware
// ============================================================

/**
 * Optionally authenticate a user if a valid token is present.
 * Does NOT throw an error if no token is provided.
 * Attaches user info to req.user if authenticated, null otherwise.
 *
 * Useful for endpoints that have different behavior for
 * authenticated vs anonymous users.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuthenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            req.user = null;
            return next();
        }

        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            req.user = null;
            return next();
        }

        const token = parts[1];

        if (!token || token === 'null' || token === 'undefined') {
            req.user = null;
            return next();
        }

        const { data, error } = await authClient.auth.getUser(token);

        if (error || !data || !data.user) {
            req.user = null;
            return next();
        }

        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('id, email, full_name, role, active')
            .eq('id', data.user.id)
            .maybeSingle();

        if (profileError || !profile || !profile.active || profile.role !== 'admin') {
            req.user = null;
            return next();
        }

        req.user = {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role,
        };

        next();
    } catch (err) {
        // Silently continue without authentication on any error
        req.user = null;
        next();
    }
}

// ============================================================
// Export
// ============================================================
module.exports = {
    authenticate,
    optionalAuthenticate,
};