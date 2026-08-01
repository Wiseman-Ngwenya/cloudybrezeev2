// ============================================================
// CloudyBreeze E-Commerce System
// Contact Service
// ============================================================
// Handles all contact message business logic.
//
// Responsibilities:
// - Create contact messages from visitors
// - List messages for admin
// - View individual messages
// - Delete messages
// ============================================================

const { serviceClient } = require('../config/supabase');
const { NotFoundError } = require('../middleware/errorHandler');
const { PAGINATION } = require('../utils/constants');

// ============================================================
// Create Contact Message
// ============================================================

/**
 * Create a new contact message from a website visitor.
 *
 * @param {Object} messageData - Contact form data
 * @param {string} messageData.name - Sender name
 * @param {string} messageData.email - Sender email
 * @param {string} [messageData.subject] - Message subject
 * @param {string} messageData.message - Message body
 * @returns {Promise<Object>} Created message record
 */
async function createContactMessage(messageData) {
    const { name, email, subject, message } = messageData;

    const { data, error } = await serviceClient
        .from('contact_messages')
        .insert({
            name,
            email,
            subject: subject || null,
            message,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating contact message:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Admin Queries
// ============================================================

/**
 * Get all contact messages for admin management.
 * Paginated, newest first.
 *
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} Messages with pagination metadata
 */
async function adminGetAllMessages(options = {}) {
    const { page = 1, limit = PAGINATION.ADMIN_CONTACTS_PER_PAGE } = options;

    const offset = (page - 1) * limit;

    const { data, error, count } = await serviceClient
        .from('contact_messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching contact messages:', error);
        throw error;
    }

    return {
        messages: data || [],
        count: count || 0,
        pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
        },
    };
}

/**
 * Get a single contact message by ID for admin.
 *
 * @param {string} id - Message UUID
 * @returns {Promise<Object>} Message details
 * @throws {NotFoundError} If message not found
 */
async function adminGetMessageById(id) {
    const { data, error } = await serviceClient
        .from('contact_messages')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        throw new NotFoundError('Contact message not found.');
    }

    return data;
}

// ============================================================
// Delete Message
// ============================================================

/**
 * Delete a contact message.
 *
 * @param {string} id - Message UUID
 * @returns {Promise<Object>} Deletion confirmation
 * @throws {NotFoundError} If message not found
 */
async function deleteMessage(id) {
    // Verify message exists
    await adminGetMessageById(id);

    const { error } = await serviceClient
        .from('contact_messages')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting contact message:', error);
        throw error;
    }

    return { deleted: true, id };
}

// ============================================================
// Message Statistics
// ============================================================

/**
 * Get unread message count (all messages are considered for display).
 * Returns total message count for admin dashboard badge.
 *
 * @returns {Promise<number>} Total message count
 */
async function getMessageCount() {
    const { count, error } = await serviceClient
        .from('contact_messages')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting contact messages:', error);
        return 0;
    }

    return count || 0;
}

// ============================================================
// Export
// ============================================================
module.exports = {
    createContactMessage,
    adminGetAllMessages,
    adminGetMessageById,
    deleteMessage,
    getMessageCount,
};