// ============================================================
// CloudyBreeze E-Commerce System
// Analytics Controller
// ============================================================
// Handles HTTP request/response for analytics operations.
//
// Responsibilities:
// - Parse request inputs and visitor data
// - Call analytics service layer
// - Format and send responses
// - Fire-and-forget page view recording
// - No business logic (delegated to analyticsService)
// ============================================================

const analyticsService = require('../services/analyticsService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * POST /api/analytics/pageview
 *
 * Record a page view from the frontend.
 * This endpoint is designed to be called asynchronously from the browser.
 * It always returns 200 OK immediately, even if recording fails.
 *
 * Body: { page, referrer?, browser?, operating_system?, device?, country?, city? }
 * Returns: { recorded: true } always
 */
const recordPageView = asyncHandler(async (req, res) => {
    // Extract IP address from request
    const ipAddress =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        null;

    const visitorData = {
        ip_address: ipAddress,
        country: req.body.country || null,
        city: req.body.city || null,
        browser: req.body.browser || null,
        operating_system: req.body.operating_system || null,
        device: req.body.device || null,
        page: req.body.page || req.headers.referer || '/',
        referrer: req.body.referrer || null,
    };

    // Fire-and-forget: Don't await, don't block the response
    analyticsService.recordPageView(visitorData).catch((err) => {
        // Logging only; error already handled inside service
        console.error('Analytics page view recording failed:', err.message);
    });

    // Always return success immediately
    res.status(200).json({
        success: true,
        data: { recorded: true },
    });
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/analytics/overview
 *
 * Get dashboard overview statistics.
 * Returns: { visitors, orders, revenue, recentVisitors, recentOrders }
 */
const getOverview = asyncHandler(async (req, res) => {
    const overview = await analyticsService.getOverview();

    res.status(200).json(
        successResponse(overview)
    );
});

/**
 * GET /api/admin/analytics/visitors
 *
 * Get visitor statistics.
 * Query params: period (today, week, month, year)
 * Returns: { dailyVisitors, uniqueVisitors, deviceStats, browserStats, osStats }
 */
const getVisitorStats = asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';

    const [dailyVisitors, uniqueVisitors, deviceStats, browserStats, osStats] =
        await Promise.all([
            analyticsService.getDailyVisitors(period),
            analyticsService.getUniqueVisitors(period),
            analyticsService.getDeviceStats(),
            analyticsService.getBrowserStats(),
            analyticsService.getOperatingSystemStats(),
        ]);

    res.status(200).json(
        successResponse({
            dailyVisitors,
            uniqueVisitors,
            deviceStats,
            browserStats,
            osStats,
        })
    );
});

/**
 * GET /api/admin/analytics/geography
 *
 * Get geographic analytics.
 * Returns: { topCountries }
 */
const getGeographyStats = asyncHandler(async (req, res) => {
    const [topCountries] = await Promise.all([
        analyticsService.getTopCountries(),
    ]);

    res.status(200).json(
        successResponse({
            topCountries,
        })
    );
});

/**
 * GET /api/admin/analytics/pages
 *
 * Get page view statistics.
 * Returns: { topPages, topReferrers }
 */
const getPageStats = asyncHandler(async (req, res) => {
    const [topPages, topReferrers] = await Promise.all([
        analyticsService.getTopPages(),
        analyticsService.getTopReferrers(),
    ]);

    res.status(200).json(
        successResponse({
            topPages,
            topReferrers,
        })
    );
});

/**
 * GET /api/admin/analytics/products
 *
 * Get product view statistics.
 * Returns: { productViews } - Products with view counts
 */
const getProductStats = asyncHandler(async (req, res) => {
    const productViews = await analyticsService.getProductViewStats();

    res.status(200).json(
        successResponse({
            productViews,
        })
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    recordPageView,
    getOverview,
    getVisitorStats,
    getGeographyStats,
    getPageStats,
    getProductStats,
};