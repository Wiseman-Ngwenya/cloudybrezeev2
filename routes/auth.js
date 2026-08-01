// ============================================================
// CloudyBreeze E-Commerce System
// Authentication Routes
// ============================================================
// Defines routes for admin authentication.
// All routes are mounted at /api/admin/auth
// ============================================================

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { handleValidationResult } = require('../middleware/validate');
const { body } = require('express-validator');
const { VALIDATION } = require('../utils/constants');

// ============================================================
// Validation Rules
// ============================================================

const loginValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: VALIDATION.EMAIL_MAX_LENGTH })
        .withMessage(`Email must not exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters`),

    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isString()
        .withMessage('Password must be a string'),

    handleValidationResult,
];

const refreshValidation = [
    body('refresh_token')
        .notEmpty()
        .withMessage('Refresh token is required')
        .isString()
        .withMessage('Refresh token must be a string'),

    handleValidationResult,
];

// ============================================================
// Routes
// ============================================================

// POST /api/admin/auth/login
// Authenticate admin user and return tokens
router.post('/login', loginValidation, authController.login);

// POST /api/admin/auth/logout
// Sign out the current admin user
router.post('/logout', authController.logout);

// GET /api/admin/auth/me
// Get the currently authenticated admin user's profile
router.get('/me', authenticate, authController.getCurrentUser);

// POST /api/admin/auth/verify
// Verify if an access token is still valid
router.post('/verify', authController.verifyToken);

// POST /api/admin/auth/refresh
// Refresh an expired access token
router.post('/refresh', refreshValidation, authController.refreshToken);

// ============================================================
// Export
// ============================================================
module.exports = router;