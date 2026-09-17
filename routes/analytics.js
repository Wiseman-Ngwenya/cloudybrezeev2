// ============================================================
// CloudyBreeze E-Commerce System
// Analytics Routes
// ============================================================

const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');

// Public analytics routes
router.post('/pageview', analyticsController.recordPageView);
router.post('/product-view', analyticsController.recordProductView);
router.get('/products/top', productController.getMostViewedProducts);

// All admin analytics routes require an authenticated active admin.
router.use('/admin', authenticate);
router.get('/admin/overview', analyticsController.getOverview);
router.get('/admin/visitors', analyticsController.getVisitorStats);
router.get('/admin/geography', analyticsController.getGeographyStats);
router.get('/admin/pages', analyticsController.getPageStats);
router.get('/admin/products', analyticsController.getProductStats);
router.get('/admin/experiment', analyticsController.getExperimentOverview);

module.exports = router;
