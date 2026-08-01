// ============================================================
// CloudyBreeze E-Commerce System
// Category Routes
// ============================================================
// Defines routes for category operations.
// Public routes mounted at /api/categories
// Admin routes mounted at /api/admin/categories
// ============================================================

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const {
    categoryValidationRules,
    uuidParam,
    handleValidationResult,
} = require('../middleware/validate');

// ============================================================
// Public Routes
// ============================================================

// GET /api/categories
// Get all active categories for public display
router.get('/', categoryController.getAllCategories);

// GET /api/categories/:slug
// Get a single active category by slug
router.get('/:slug', categoryController.getCategoryBySlug);

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/categories
// Get all categories (including inactive) for admin management
router.get('/admin', categoryController.adminGetAllCategories);

// GET /api/admin/categories/:id
// Get a single category by ID for admin
router.get(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    categoryController.adminGetCategoryById
);

// POST /api/admin/categories
// Create a new category
router.post(
    '/admin',
    categoryValidationRules,
    handleValidationResult,
    categoryController.createCategory
);

// PUT /api/admin/categories/:id
// Update an existing category
router.put(
    '/admin/:id',
    uuidParam('id'),
    categoryValidationRules,
    handleValidationResult,
    categoryController.updateCategory
);

// DELETE /api/admin/categories/:id
// Delete a category
router.delete(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    categoryController.deleteCategory
);

// ============================================================
// Export
// ============================================================
module.exports = router;