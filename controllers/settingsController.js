// ============================================================
// CloudyBreeze E-Commerce System
// Settings Controller
// ============================================================
// Handles HTTP request/response for store settings operations.
//
// Responsibilities:
// - Parse request inputs
// - Call settings service layer
// - Format and send responses
// - No business logic (delegated to settingsService)
// ============================================================

const settingsService = require('../services/settingsService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * GET /api/settings
 *
 * Get store settings for public display.
 * Returns: Formatted settings with store info, shipping, social links, SEO
 */
const getPublicSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.getPublicSettings();

    res.status(200).json(
        successResponse(settings)
    );
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/settings
 *
 * Get all store settings for admin management.
 * Returns: Raw settings object (all fields, snake_case)
 */
const getSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.getSettings(true);

    res.status(200).json(
        successResponse(settings)
    );
});

/**
 * PUT /api/admin/settings
 *
 * Update store settings.
 * Body: { store_name?, email?, phone?, address?, currency?,
 *         shipping_cost?, free_shipping_threshold?,
 *         facebook?, instagram?, twitter?,
 *         seo_title?, seo_description? }
 * Returns: Updated settings object
 */
const updateSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.updateSettings(req.body);

    res.status(200).json(
        successResponse(settings, 'Store settings updated successfully.')
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    getPublicSettings,
    getSettings,
    updateSettings,
};