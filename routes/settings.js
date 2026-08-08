// ============================================================
// CloudyBreeze E-Commerce System
// Settings Routes
// ============================================================

const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const {
    settingsValidationRules,
    handleValidationResult,
} = require('../middleware/validate');

// Public routes - mounted at /api/settings
router.get('/', settingsController.getPublicSettings);
router.get('/shipping-countries', settingsController.getPublicShippingCountries);

// Admin routes - mounted at /api/settings/admin/*
router.use('/admin', authenticate);

router.get('/admin', settingsController.getSettings);

router.put(
    '/admin',
    settingsValidationRules,
    handleValidationResult,
    settingsController.updateSettings
);

router.get('/admin/shipping-countries', settingsController.getShippingCountries);
router.post('/admin/shipping-countries', settingsController.createShippingCountry);
router.patch('/admin/shipping-countries/:id', settingsController.updateShippingCountry);
router.delete('/admin/shipping-countries/:id', settingsController.deleteShippingCountry);

module.exports = router;