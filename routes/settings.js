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

// Public settings
router.get('/', settingsController.getPublicSettings);
router.get('/shipping-countries', settingsController.getPublicShippingCountries);

// Admin routes
router.use('/admin', authenticate);

router.get('/admin', settingsController.getSettings);

router.put(
    '/admin',
    settingsValidationRules,
    handleValidationResult,
    settingsController.updateSettings
);

// Shipping countries - admin CRUD
router.get('/admin/settings/shipping-countries', settingsController.getShippingCountries);
router.post('/admin/settings/shipping-countries', settingsController.createShippingCountry);
router.patch('/admin/settings/shipping-countries/:id', settingsController.updateShippingCountry);
router.delete('/admin/settings/shipping-countries/:id', settingsController.deleteShippingCountry);

module.exports = router;