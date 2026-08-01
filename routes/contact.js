// ============================================================
// CloudyBreeze E-Commerce System
// Contact Routes
// ============================================================
// Defines routes for contact operations.
// Public routes mounted at /api/contact
// Admin routes mounted at /api/admin/contacts
// ============================================================

const express = require('express');
const router = express.Router();

const contactController = require('../controllers/contactController');
const { authenticate } = require('../middleware/auth');
const {
    contactValidationRules,
    uuidParam,
    handleValidationResult,
} = require('../middleware/validate');

// ============================================================
// Public Routes
// ============================================================

// POST /api/contact
// Send a contact message from a website visitor
router.post(
    '/',
    contactValidationRules,
    handleValidationResult,
    contactController.createContactMessage
);

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/contacts
// Get all contact messages with pagination
router.get('/admin', contactController.adminGetAllMessages);

// GET /api/admin/contacts/:id
// Get a single contact message by ID
router.get(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    contactController.adminGetMessageById
);

// DELETE /api/admin/contacts/:id
// Delete a contact message
router.delete(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    contactController.deleteMessage
);

// ============================================================
// Export
// ============================================================
module.exports = router;