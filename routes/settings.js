// ============================================================
// CloudyBreeze E-Commerce System
// Settings Routes
// ============================================================
// Defines routes for store settings operations.
// Public routes mounted at /api/settings
// Admin routes mounted at /api/admin/settings
// ============================================================

const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const {
    settingsValidationRules,
    handleValidationResult,
} = require('../middleware/validate');

// ============================================================
// Public Routes
// ============================================================

// GET /api/settings
// Get store settings for public display
router.get('/', settingsController.getPublicSettings);

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/settings
// Get all store settings for admin management
router.get('/admin', settingsController.getSettings);

// PUT /api/admin/settings
// Update store settings
router.put(
    '/admin',
    settingsValidationRules,
    handleValidationResult,
    settingsController.updateSettings
);

// ============================================================
// Export
// ============================================================
module.exports = router;