// ============================================================
// CloudyBreeze E-Commerce System
// Analytics Controller
// ============================================================

const analyticsService = require('../services/analyticsService');
const experimentService = require('../services/experimentService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

function normalizePath(value) {
    if (!value) return '/';
    let normalized = String(value).trim();
    try {
        if (/^https?:\/\//i.test(normalized)) normalized = new URL(normalized).pathname;
    } catch (_) {}
    normalized = normalized.split('?')[0].split('#')[0] || '/';
    if (normalized.length > 1) normalized = normalized.replace(/\/+$/, '');
    return normalized || '/';
}

function inferCountry(req) {
    return req.body.country || req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || req.headers['x-country'] || null;
}

function pageNameFromPath(pagePath) {
    const path = normalizePath(pagePath);
    const namedRoutes = {
        '/': 'Home', '/about': 'About', '/products': 'Products', '/contact': 'Contact',
        '/cart': 'Cart', '/checkout': 'Checkout', '/tracking': 'Track Order',
        '/shipping': 'Shipping', '/terms': 'Terms', '/refund-policy': 'Refund Policy',
        '/privacy-policy': 'Privacy Policy',
    };
    return namedRoutes[path] || path;
}

const recordPageView = asyncHandler(async (req, res) => {
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
    const pagePath = normalizePath(req.body.page || req.headers.referer || req.headers.referrer || req.originalUrl || '/');
    const visitorData = {
        ip_address: ipAddress,
        country: inferCountry(req),
        city: req.body.city || null,
        browser: req.body.browser || null,
        operating_system: req.body.operating_system || null,
        device: req.body.device || null,
        page: pageNameFromPath(pagePath),
        referrer: req.body.referrer ? normalizePath(req.body.referrer) : (req.headers.referer ? normalizePath(req.headers.referer) : null),
    };
    analyticsService.recordPageView(visitorData).catch((err) => console.error('Analytics page view recording failed:', err.message));
    res.status(200).json({ success: true, data: { recorded: true } });
});

const recordProductView = asyncHandler(async (req, res) => {
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
    await analyticsService.recordProductView({
        product_id: req.body.product_id,
        session_id: req.body.session_id || null,
        page_path: normalizePath(req.body.page_path || req.originalUrl || '/'),
        referrer: req.body.referrer ? normalizePath(req.body.referrer) : (req.headers.referer ? normalizePath(req.headers.referer) : null),
        country: inferCountry(req), city: req.body.city || null,
        browser: req.body.browser || null, operating_system: req.body.operating_system || null,
        device: req.body.device || null, ip_address: ipAddress,
    });
    res.status(200).json({ success: true, data: { recorded: true } });
});

const getOverview = asyncHandler(async (req, res) => {
    const overview = await analyticsService.getOverview();
    res.status(200).json(successResponse(overview));
});

const getVisitorStats = asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const [dailyVisitors, uniqueVisitors, deviceStats, browserStats, osStats] = await Promise.all([
        analyticsService.getDailyVisitors(period), analyticsService.getUniqueVisitors(period),
        analyticsService.getDeviceStats(), analyticsService.getBrowserStats(), analyticsService.getOperatingSystemStats(),
    ]);
    res.status(200).json(successResponse({ dailyVisitors, uniqueVisitors, deviceStats, browserStats, osStats }));
});

const getGeographyStats = asyncHandler(async (req, res) => {
    res.status(200).json(successResponse({ topCountries: await analyticsService.getTopCountries() }));
});

const getPageStats = asyncHandler(async (req, res) => {
    const [topPages, topReferrers] = await Promise.all([analyticsService.getTopPages(), analyticsService.getTopReferrers()]);
    res.status(200).json(successResponse({ topPages, topReferrers }));
});

const getProductStats = asyncHandler(async (req, res) => {
    res.status(200).json(successResponse({ productViews: await analyticsService.getProductViewStats() }));
});

const getExperimentOverview = asyncHandler(async (req, res) => {
    const overview = await experimentService.getOverview();
    res.status(200).json(successResponse(overview));
});

const getExperimentSessions = asyncHandler(async (req, res) => {
    const result = await experimentService.getRecentSessions({
        limit: req.query.limit,
        offset: req.query.offset,
    });
    res.status(200).json(successResponse(result));
});

const getExperimentSession = asyncHandler(async (req, res) => {
    const result = await experimentService.getSessionDetail(req.params.sessionId);
    res.status(200).json(successResponse(result));
});

module.exports = {
    recordPageView,
    recordProductView,
    getOverview,
    getVisitorStats,
    getGeographyStats,
    getPageStats,
    getProductStats,
    getExperimentOverview,
    getExperimentSessions,
    getExperimentSession,
};
