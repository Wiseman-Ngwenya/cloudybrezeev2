// ============================================================
// CloudyBreeze E-Commerce System
// Analytics Routes
// ============================================================
// Defines routes for analytics operations.
// Public routes mounted at /api/analytics
// Admin routes mounted at /api/admin/analytics
// ============================================================

const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

// ============================================================
// Public Routes
// ============================================================

// POST /api/analytics/pageview
// Record a page view (fire-and-forget, always returns 200)
router.post('/pageview', analyticsController.recordPageView);

// GET /api/analytics/products/top
// Get most viewed products
router.get('/products/top', productController.getMostViewedProducts);

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/analytics/overview
// Get dashboard overview statistics
router.get('/admin/overview', analyticsController.getOverview);

// GET /api/admin/analytics/visitors
// Get visitor statistics (daily, unique, devices, browsers, OS)
router.get('/admin/visitors', analyticsController.getVisitorStats);

// GET /api/admin/analytics/geography
// Get geographic analytics (top countries)
router.get('/admin/geography', analyticsController.getGeographyStats);

// GET /api/admin/analytics/pages
// Get page view statistics (top pages, top referrers)
router.get('/admin/pages', analyticsController.getPageStats);

// GET /api/admin/analytics/products
// Get product view statistics
router.get('/admin/products', analyticsController.getProductStats);

// ============================================================
// Export
// ============================================================
module.exports = router;