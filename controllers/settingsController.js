// ============================================================
// CloudyBreeze E-Commerce System
// Settings Controller
// ============================================================

const settingsService = require('../services/settingsService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

const getPublicSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.getPublicSettings();
    res.status(200).json(successResponse(settings));
});

const getPublicShippingCountries = asyncHandler(async (req, res) => {
    const countries = await settingsService.getPublicShippingCountries();
    res.status(200).json(successResponse(countries));
});

// ============================================================
// Admin Controllers
// ============================================================

const getSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.getSettings(true);
    res.status(200).json(successResponse(settings));
});

const updateSettings = asyncHandler(async (req, res) => {
    const settings = await settingsService.updateSettings(req.body);
    res.status(200).json(successResponse(settings, 'Store settings updated successfully.'));
});

const getShippingCountries = asyncHandler(async (req, res) => {
    const countries = await settingsService.getShippingCountries(true);
    res.status(200).json(successResponse(countries));
});

const createShippingCountry = asyncHandler(async (req, res) => {
    const country = await settingsService.createShippingCountry(req.body || {});
    res.status(201).json(successResponse(country, 'Shipping country created successfully.'));
});

const updateShippingCountry = asyncHandler(async (req, res) => {
    const country = await settingsService.updateShippingCountry(req.params.id, req.body || {});
    res.status(200).json(successResponse(country, 'Shipping country updated successfully.'));
});

const deleteShippingCountry = asyncHandler(async (req, res) => {
    await settingsService.deleteShippingCountry(req.params.id);
    res.status(200).json(successResponse(null, 'Shipping country deleted successfully.'));
});

module.exports = {
    getPublicSettings,
    getPublicShippingCountries,
    getSettings,
    updateSettings,
    getShippingCountries,
    createShippingCountry,
    updateShippingCountry,
    deleteShippingCountry,
};