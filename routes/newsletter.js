// ============================================================
// CloudyBreeze E-Commerce System
// Newsletter Routes
// ============================================================
// Defines routes for newsletter operations.
// Public routes mounted at /api/newsletter
// Admin routes mounted at /api/admin/newsletter
// ============================================================

const express = require('express');
const router = express.Router();

const newsletterController = require('../controllers/newsletterController');
const { authenticate } = require('../middleware/auth');
const {
    newsletterValidationRules,
    uuidParam,
    handleValidationResult,
} = require('../middleware/validate');

// ============================================================
// Public Routes
// ============================================================

// POST /api/newsletter
// Subscribe an email address to the newsletter
router.post(
    '/',
    newsletterValidationRules,
    handleValidationResult,
    newsletterController.subscribe
);

// POST /api/newsletter/unsubscribe
// Unsubscribe an email address from the newsletter
router.post(
    '/unsubscribe',
    newsletterValidationRules,
    handleValidationResult,
    newsletterController.unsubscribe
);

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/newsletter
// Get all subscribers with pagination and search
router.get('/admin', newsletterController.adminGetAllSubscribers);

// GET /api/admin/newsletter/stats
// Get subscriber statistics
router.get('/admin/stats', newsletterController.getSubscriberStats);

// GET /api/admin/newsletter/:id
// Get a single subscriber by ID
router.get(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    newsletterController.adminGetSubscriberById
);

// DELETE /api/admin/newsletter/:id
// Remove a subscriber
router.delete(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    newsletterController.removeSubscriber
);

// ============================================================
// Export
// ============================================================
module.exports = router;