// ============================================================
// CloudyBreeze E-Commerce System
// Newsletter Controller
// ============================================================
// Handles HTTP request/response for newsletter operations.
//
// Responsibilities:
// - Parse request inputs
// - Call newsletter service layer
// - Format and send responses
// - No business logic (delegated to newsletterService)
// ============================================================

const newsletterService = require('../services/newsletterService');
const { successResponse, paginatedResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * POST /api/newsletter
 *
 * Subscribe an email address to the newsletter.
 * Body: { email }
 * Returns: { subscribed: true, message }
 */
const subscribe = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const result = await newsletterService.subscribe(email);

    res.status(200).json(
        successResponse(result, result.message)
    );
});

/**
 * POST /api/newsletter/unsubscribe
 *
 * Unsubscribe an email address from the newsletter.
 * Body: { email }
 * Returns: { unsubscribed: true, message }
 */
const unsubscribe = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const result = await newsletterService.unsubscribeByEmail(email);

    res.status(200).json(
        successResponse(result, result.message)
    );
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/newsletter
 *
 * Get all newsletter subscribers for admin management.
 * Query params: page, limit, search
 * Returns: Paginated subscribers, newest first
 */
const adminGetAllSubscribers = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        search: req.query.search || null,
    };

    const result = await newsletterService.adminGetAllSubscribers(options);

    res.status(200).json(
        paginatedResponse(
            result.subscribers,
            result.count,
            result.pagination.page,
            result.pagination.limit
        )
    );
});

/**
 * GET /api/admin/newsletter/:id
 *
 * Get a single subscriber by ID.
 * Returns: Subscriber details
 */
const adminGetSubscriberById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const subscriber = await newsletterService.adminGetSubscriberById(id);

    res.status(200).json(
        successResponse(subscriber)
    );
});

/**
 * DELETE /api/admin/newsletter/:id
 *
 * Remove a subscriber from the newsletter list.
 * Returns: { deleted: true, id }
 */
const removeSubscriber = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await newsletterService.removeSubscriber(id);

    res.status(200).json(
        successResponse(result, 'Subscriber removed successfully.')
    );
});

// ============================================================
// Subscriber Statistics
// ============================================================

/**
 * GET /api/admin/newsletter/stats
 *
 * Get newsletter subscriber statistics.
 * Query params: startDate, endDate (optional)
 * Returns: { totalSubscribers, newSubscribers }
 */
const getSubscriberStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const [totalSubscribers, newSubscribers] = await Promise.all([
        newsletterService.getSubscriberCount(),
        newsletterService.getSubscriberCountByDateRange(startDate, endDate),
    ]);

    res.status(200).json(
        successResponse({
            totalSubscribers,
            newSubscribers,
        })
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    subscribe,
    unsubscribe,
    adminGetAllSubscribers,
    adminGetSubscriberById,
    removeSubscriber,
    getSubscriberStats,
};