// ============================================================
// CloudyBreeze E-Commerce System
// Authentication Controller
// ============================================================
// Handles HTTP request/response for admin authentication.
//
// Responsibilities:
// - Parse request inputs
// - Call auth service layer
// - Format and send responses
// - No business logic (delegated to authService)
// ============================================================

const authService = require('../services/authService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Login
// ============================================================

/**
 * POST /api/admin/auth/login
 *
 * Authenticate an admin user.
 * Body: { email, password }
 * Returns: { access_token, refresh_token, expires_at, user }
 */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const authData = await authService.login(email, password);

    res.status(200).json(
        successResponse(authData, 'Login successful.')
    );
});

// ============================================================
// Logout
// ============================================================

/**
 * POST /api/admin/auth/logout
 *
 * Sign out the current admin user.
 * Header: Authorization: Bearer <token>
 * Returns: { loggedOut: true }
 */
const logout = asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    let accessToken = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.split(' ')[1];
    }

    const result = await authService.logout(accessToken);

    res.status(200).json(
        successResponse(result, 'Logout successful.')
    );
});

// ============================================================
// Get Current User
// ============================================================

/**
 * GET /api/admin/auth/me
 *
 * Get the currently authenticated admin user's profile.
 * Header: Authorization: Bearer <token>
 * Returns: { id, email, fullName, role, active, createdAt, updatedAt }
 */
const getCurrentUser = asyncHandler(async (req, res) => {
    // req.user is set by the authenticate middleware
    const user = await authService.getCurrentUser(req.user);

    res.status(200).json(
        successResponse(user)
    );
});

// ============================================================
// Verify Token
// ============================================================

/**
 * POST /api/admin/auth/verify
 *
 * Verify if an access token is still valid.
 * Body: { access_token } (optional, can also use Authorization header)
 * Returns: { id, email, fullName, role, active }
 */
const verifyToken = asyncHandler(async (req, res) => {
    // Get token from body or Authorization header
    let accessToken = req.body.access_token || null;

    if (!accessToken && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.split(' ')[1];
        }
    }

    const user = await authService.verifyToken(accessToken);

    res.status(200).json(
        successResponse({
            valid: true,
            user,
        })
    );
});

// ============================================================
// Refresh Token
// ============================================================

/**
 * POST /api/admin/auth/refresh
 *
 * Refresh an expired access token using a refresh token.
 * Body: { refresh_token }
 * Returns: { access_token, refresh_token, expires_at }
 */
const refreshToken = asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;

    const sessionData = await authService.refreshSession(refresh_token);

    res.status(200).json(
        successResponse(sessionData, 'Token refreshed successfully.')
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    login,
    logout,
    getCurrentUser,
    verifyToken,
    refreshToken,
};