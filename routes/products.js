// ============================================================
// CloudyBreeze E-Commerce System
// Product Routes
// ============================================================
// Defines routes for product operations.
// Public routes mounted at /api/products
// Admin routes mounted at /api/admin/products
// ============================================================

const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const {
    productValidationRules,
    uuidParam,
    handleValidationResult,
} = require('../middleware/validate');
const { body } = require('express-validator');

// ============================================================
// Validation Rules for Nested Resources
// ============================================================

const variantValidationRules = [
    body('variation_name')
        .trim()
        .notEmpty()
        .withMessage('Variation name is required')
        .isLength({ max: 100 })
        .withMessage('Variation name must not exceed 100 characters'),

    body('sku')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('SKU must not exceed 50 characters'),

    body('price_adjustment')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Price adjustment must be a valid decimal number')
        .toFloat(),

    body('image_url')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Image URL must be a valid URL'),

    body('active')
        .optional()
        .isBoolean()
        .withMessage('Active must be a boolean value')
        .toBoolean(),

    handleValidationResult,
];

const imageValidationRules = [
    body('image_url')
        .trim()
        .notEmpty()
        .withMessage('Image URL is required')
        .isURL()
        .withMessage('Image URL must be a valid URL'),

    body('is_primary')
        .optional()
        .isBoolean()
        .withMessage('is_primary must be a boolean value')
        .toBoolean(),

    body('sort_order')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Sort order must be a non-negative integer')
        .toInt(),

    handleValidationResult,
];

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/products
// Get all products for admin management
router.get('/admin', productController.adminGetAllProducts);

// GET /api/admin/products/:id
// Get a single product by ID for admin
router.get(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    productController.adminGetProductById
);

// POST /api/admin/products
// Create a new product
router.post(
    '/admin',
    productValidationRules,
    handleValidationResult,
    productController.createProduct
);

// PUT /api/admin/products/:id
// Update an existing product
router.put(
    '/admin/:id',
    uuidParam('id'),
    productValidationRules,
    handleValidationResult,
    productController.updateProduct
);

// DELETE /api/admin/products/:id
// Delete a product
router.delete(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    productController.deleteProduct
);

// PATCH /api/admin/products/:id/toggle
// Toggle product active status
router.patch(
    '/admin/:id/toggle',
    uuidParam('id'),
    handleValidationResult,
    productController.toggleProductActive
);

// ============================================================
// Product Images - Admin Routes
// ============================================================

// POST /api/admin/products/:id/images
// Add an image to a product gallery
router.post(
    '/admin/:id/images',
    uuidParam('id'),
    imageValidationRules,
    handleValidationResult,
    productController.addProductImage
);

// DELETE /api/admin/products/:id/images/:imageId
// Remove an image from a product gallery
router.delete(
    '/admin/:id/images/:imageId',
    uuidParam('id'),
    uuidParam('imageId'),
    handleValidationResult,
    productController.removeProductImage
);

// ============================================================
// Product Variants - Admin Routes
// ============================================================

// POST /api/admin/products/:id/variants
// Add a variant to a product
router.post(
    '/admin/:id/variants',
    uuidParam('id'),
    variantValidationRules,
    handleValidationResult,
    productController.addProductVariant
);

// PUT /api/admin/products/:id/variants/:variantId
// Update a product variant
router.put(
    '/admin/:id/variants/:variantId',
    uuidParam('id'),
    uuidParam('variantId'),
    variantValidationRules,
    handleValidationResult,
    productController.updateProductVariant
);

// DELETE /api/admin/products/:id/variants/:variantId
// Remove a variant from a product
router.delete(
    '/admin/:id/variants/:variantId',
    uuidParam('id'),
    uuidParam('variantId'),
    handleValidationResult,
    productController.removeProductVariant
);

// ============================================================
// Public Routes
// ============================================================

// GET /api/products
// Get all active products with filtering and pagination
router.get('/', productController.getAllProducts);

// GET /api/products/featured
// Get featured products for homepage
router.get('/featured', productController.getFeaturedProducts);

// GET /api/products/search
// Search products by query string
router.get('/search', productController.searchProducts);

// GET /api/products/category/:slug
// Get products by category slug
router.get('/category/:slug', productController.getProductsByCategory);

// GET /api/products/:slug
// Get a single product by slug with all details
router.get('/:slug', productController.getProductBySlug);

// ============================================================
// Export
// ============================================================
module.exports = router;