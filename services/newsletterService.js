// ============================================================
// CloudyBreeze E-Commerce System
// Newsletter Service
// ============================================================
// Handles all newsletter subscription business logic.
//
// Responsibilities:
// - Subscribe email addresses
// - List subscribers for admin
// - Remove subscribers
// - Duplicate email handling
// ============================================================

const { serviceClient } = require('../config/supabase');
const { NotFoundError, ConflictError } = require('../middleware/errorHandler');
const { PAGINATION } = require('../utils/constants');

// ============================================================
// Subscribe
// ============================================================

/**
 * Subscribe an email address to the newsletter.
 * If the email is already subscribed, the request succeeds silently
 * to prevent email enumeration attacks.
 *
 * @param {string} email - Email address to subscribe
 * @returns {Promise<Object>} Subscription result
 */
async function subscribe(email) {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const { data: existing } = await serviceClient
        .from('newsletter')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

    if (existing) {
        // Return success without revealing the email was already subscribed
        // This prevents email enumeration attacks
        return {
            subscribed: true,
            message: 'You have been subscribed to our newsletter.',
            alreadySubscribed: true,
        };
    }

    // Insert new subscriber
    const { data, error } = await serviceClient
        .from('newsletter')
        .insert({
            email: normalizedEmail,
        })
        .select()
        .single();

    if (error) {
        // Handle race condition where email was inserted between check and insert
        if (error.code === '23505') {
            return {
                subscribed: true,
                message: 'You have been subscribed to our newsletter.',
                alreadySubscribed: true,
            };
        }

        console.error('Error subscribing to newsletter:', error);
        throw error;
    }

    return {
        subscribed: true,
        message: 'Thank you for subscribing to our newsletter!',
        subscriber: data,
    };
}

// ============================================================
// Admin Queries
// ============================================================

/**
 * Get all newsletter subscribers for admin management.
 * Paginated, newest first.
 *
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.search] - Search by email
 * @returns {Promise<Object>} Subscribers with pagination metadata
 */
async function adminGetAllSubscribers(options = {}) {
    const {
        page = 1,
        limit = PAGINATION.ADMIN_SUBSCRIBERS_PER_PAGE,
        search,
    } = options;

    const offset = (page - 1) * limit;

    let query = serviceClient
        .from('newsletter')
        .select('*', { count: 'exact' })
        .order('subscribed_at', { ascending: false });

    // Apply search filter
    if (search) {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        query = query.ilike('email', searchTerm);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching newsletter subscribers:', error);
        throw error;
    }

    return {
        subscribers: data || [],
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
 * Get a single subscriber by ID for admin.
 *
 * @param {string} id - Subscriber UUID
 * @returns {Promise<Object>} Subscriber details
 * @throws {NotFoundError} If subscriber not found
 */
async function adminGetSubscriberById(id) {
    const { data, error } = await serviceClient
        .from('newsletter')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        throw new NotFoundError('Newsletter subscriber not found.');
    }

    return data;
}

// ============================================================
// Remove Subscriber
// ============================================================

/**
 * Remove a subscriber from the newsletter list.
 *
 * @param {string} id - Subscriber UUID
 * @returns {Promise<Object>} Deletion confirmation
 * @throws {NotFoundError} If subscriber not found
 */
async function removeSubscriber(id) {
    // Verify subscriber exists
    await adminGetSubscriberById(id);

    const { error } = await serviceClient
        .from('newsletter')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error removing newsletter subscriber:', error);
        throw error;
    }

    return { deleted: true, id };
}

/**
 * Unsubscribe by email address.
 * Allows users to unsubscribe without knowing their ID.
 * Fails silently if the email is not subscribed.
 *
 * @param {string} email - Email address to unsubscribe
 * @returns {Promise<Object>} Unsubscription result
 */
async function unsubscribeByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await serviceClient
        .from('newsletter')
        .delete()
        .eq('email', normalizedEmail);

    if (error) {
        console.error('Error unsubscribing email:', error);
        // Don't throw - silently handle for privacy
    }

    return {
        unsubscribed: true,
        message: 'You have been unsubscribed from our newsletter.',
    };
}

// ============================================================
// Subscriber Statistics
// ============================================================

/**
 * Get total subscriber count.
 * For admin dashboard display.
 *
 * @returns {Promise<number>} Total subscriber count
 */
async function getSubscriberCount() {
    const { count, error } = await serviceClient
        .from('newsletter')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting newsletter subscribers:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Get subscriber count by date range.
 * For tracking growth over time.
 *
 * @param {string} [startDate] - Start date ISO string
 * @param {string} [endDate] - End date ISO string
 * @returns {Promise<number>} Subscriber count in date range
 */
async function getSubscriberCountByDateRange(startDate, endDate) {
    let query = serviceClient
        .from('newsletter')
        .select('*', { count: 'exact', head: true });

    if (startDate) {
        query = query.gte('subscribed_at', startDate);
    }

    if (endDate) {
        query = query.lte('subscribed_at', endDate);
    }

    const { count, error } = await query;

    if (error) {
        console.error('Error counting subscribers by date range:', error);
        return 0;
    }

    return count || 0;
}

// ============================================================
// Export
// ============================================================
module.exports = {
    subscribe,
    adminGetAllSubscribers,
    adminGetSubscriberById,
    removeSubscriber,
    unsubscribeByEmail,
    getSubscriberCount,
    getSubscriberCountByDateRange,
};