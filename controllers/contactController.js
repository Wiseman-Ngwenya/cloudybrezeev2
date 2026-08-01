// ============================================================
// CloudyBreeze E-Commerce System
// Contact Controller
// ============================================================
// Handles HTTP request/response for contact operations.
//
// Responsibilities:
// - Parse request inputs
// - Call contact service layer
// - Format and send responses
// - No business logic (delegated to contactService)
// ============================================================

const contactService = require('../services/contactService');
const { successResponse, paginatedResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * POST /api/contact
 *
 * Send a contact message from a website visitor.
 * Body: { name, email, subject?, message }
 * Returns: Created message record
 */
const createContactMessage = asyncHandler(async (req, res) => {
    const message = await contactService.createContactMessage(req.body);

    res.status(201).json(
        successResponse(message, 'Your message has been sent successfully. We will get back to you soon.')
    );
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/contacts
 *
 * Get all contact messages for admin management.
 * Query params: page, limit
 * Returns: Paginated messages, newest first
 */
const adminGetAllMessages = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
    };

    const result = await contactService.adminGetAllMessages(options);

    res.status(200).json(
        paginatedResponse(
            result.messages,
            result.count,
            result.pagination.page,
            result.pagination.limit
        )
    );
});

/**
 * GET /api/admin/contacts/:id
 *
 * Get a single contact message by ID.
 * Returns: Message details
 */
const adminGetMessageById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const message = await contactService.adminGetMessageById(id);

    res.status(200).json(
        successResponse(message)
    );
});

/**
 * DELETE /api/admin/contacts/:id
 *
 * Delete a contact message.
 * Returns: { deleted: true, id }
 */
const deleteMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await contactService.deleteMessage(id);

    res.status(200).json(
        successResponse(result, 'Contact message deleted successfully.')
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    createContactMessage,
    adminGetAllMessages,
    adminGetMessageById,
    deleteMessage,
};