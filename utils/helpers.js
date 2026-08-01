// ============================================================
// CloudyBreeze E-Commerce System
// Helper Utility Functions
// ============================================================
// Reusable utility functions used across the application.
// All functions are pure and have no side effects unless noted.
// ============================================================

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
    ORDER_NUMBER_PREFIX,
    ORDER_NUMBER_PAD_LENGTH,
    CURRENCY,
} = require('./constants');

// ============================================================
// Order Number Generation
// ============================================================

/**
 * Generate a unique order number in the format: CB-YYYYNNNNNN
 * Example: CB-2026000125
 *
 * @param {number} sequenceNumber - Sequential order number
 * @returns {string} Formatted order number
 */
function generateOrderNumber(sequenceNumber) {
    const year = new Date().getFullYear();
    const paddedSequence = String(sequenceNumber).padStart(ORDER_NUMBER_PAD_LENGTH, '0');
    return `${ORDER_NUMBER_PREFIX}${year}${paddedSequence}`;
}

// ============================================================
// Slug Generation
// ============================================================

/**
 * Convert a string to a URL-friendly slug.
 *
 * @param {string} text - Input text to convert
 * @returns {string} URL-safe slug
 */
function generateSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with hyphens
        .replace(/[^\w-]+/g, '')        // Remove non-word characters
        .replace(/--+/g, '-')           // Replace multiple hyphens with single
        .replace(/^-+/, '')             // Trim hyphens from start
        .replace(/-+$/, '');            // Trim hyphens from end
}

/**
 * Generate a unique slug by appending a short UUID if needed.
 *
 * @param {string} text - Input text to convert
 * @returns {string} Unique URL-safe slug
 */
function generateUniqueSlug(text) {
    const slug = generateSlug(text);
    const shortId = uuidv4().split('-')[0];
    return `${slug}-${shortId}`;
}

// ============================================================
// Filename Sanitization
// ============================================================

/**
 * Sanitize and generate a unique filename for uploaded files.
 *
 * @param {string} originalFilename - Original uploaded filename
 * @returns {string} Sanitized unique filename
 */
function sanitizeFilename(originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    const name = path.basename(originalFilename, ext);
    const sanitized = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with hyphens
        .replace(/[^\w-]+/g, '')        // Remove non-word characters
        .replace(/--+/g, '-')           // Replace multiple hyphens with single
        .replace(/^-+/, '')             // Trim hyphens from start
        .replace(/-+$/, '')             // Trim hyphens from end
        .substring(0, 100);             // Limit filename length
    const uniqueId = uuidv4().split('-')[0];
    return `${uniqueId}-${sanitized}${ext}`;
}

// ============================================================
// Currency Formatting
// ============================================================

/**
 * Format a number as currency with symbol and decimal places.
 *
 * @param {number} amount - Amount to format
 * @param {string} [currencySymbol] - Currency symbol (defaults to '$')
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currencySymbol = CURRENCY.SYMBOL) {
    const num = parseFloat(amount);
    if (isNaN(num)) return `${currencySymbol}0.00`;
    return `${currencySymbol}${num.toFixed(CURRENCY.DECIMAL_PLACES)}`;
}

/**
 * Convert a decimal amount to cents for payment processing.
 *
 * @param {number} amount - Amount in dollars
 * @returns {number} Amount in cents
 */
function toCents(amount) {
    return Math.round(parseFloat(amount) * 100);
}

/**
 * Convert cents to decimal amount.
 *
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
function fromCents(cents) {
    return parseFloat((cents / 100).toFixed(CURRENCY.DECIMAL_PLACES));
}

// ============================================================
// Data Sanitization
// ============================================================

/**
 * Strip HTML tags from a string for safe display.
 *
 * @param {string} str - String that may contain HTML
 * @returns {string} String with HTML tags removed
 */
function stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Truncate text to a specified length with ellipsis.
 *
 * @param {string} str - Text to truncate
 * @param {number} [maxLength=100] - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(str, maxLength = 100) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength).trim() + '...';
}

// ============================================================
// Response Helpers
// ============================================================

/**
 * Create a standardized success response.
 *
 * @param {*} data - Response data
 * @param {string} [message] - Optional success message
 * @returns {Object} Standardized success response object
 */
function successResponse(data, message = null) {
    const response = {
        success: true,
        data,
    };
    if (message) {
        response.message = message;
    }
    return response;
}

/**
 * Create a standardized paginated response.
 *
 * @param {Array} data - Array of items
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Standardized paginated response object
 */
function paginatedResponse(data, total, page, limit) {
    return {
        success: true,
        data,
        count: data.length,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

/**
 * Create a standardized error response.
 *
 * @param {string} code - Error code
 * @param {string} message - Human-readable error message
 * @returns {Object} Standardized error response object
 */
function errorResponse(code, message) {
    return {
        success: false,
        error: {
            code,
            message,
        },
    };
}

// ============================================================
// Pagination Helpers
// ============================================================

/**
 * Calculate pagination offset and limit from query parameters.
 *
 * @param {Object} query - Express request query object
 * @param {number} [defaultLimit=20] - Default items per page
 * @param {number} [maxLimit=100] - Maximum items per page
 * @returns {Object} Object with limit and offset
 */
function getPaginationParams(query, defaultLimit = 20, maxLimit = 100) {
    let page = parseInt(query.page, 10) || 1;
    let limit = parseInt(query.limit, 10) || defaultLimit;

    if (page < 1) page = 1;
    if (limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Check if a value is a valid email address.
 *
 * @param {string} email - Email address to validate
 * @returns {boolean} Whether the email is valid
 */
function isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Check if a value is a valid URL.
 *
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is valid
 */
function isValidUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (err) {
        return false;
    }
}

/**
 * Check if a value is a valid phone number.
 * Accepts digits, spaces, hyphens, parentheses, and plus sign.
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether the phone number is valid
 */
function isValidPhone(phone) {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[+\d][\d\s\-()]{4,19}$/;
    return phoneRegex.test(phone);
}

// ============================================================
// Date Helpers
// ============================================================

/**
 * Get start and end dates for a given period.
 *
 * @param {string} period - 'today', 'week', 'month', 'year'
 * @returns {Object} Object with startDate and endDate
 */
function getDateRange(period) {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date(now);

    switch (period) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        default:
            startDate.setHours(0, 0, 0, 0);
    }

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    };
}

/**
 * Format a date string to a human-readable format.
 *
 * @param {string} dateString - ISO date string
 * @param {Object} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatDate(dateString, options = {}) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    };
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
}

// ============================================================
// Array Helpers
// ============================================================

/**
 * Remove duplicate items from an array.
 *
 * @param {Array} arr - Input array
 * @returns {Array} Array with unique items
 */
function uniqueArray(arr) {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr)];
}

/**
 * Chunk an array into smaller arrays of specified size.
 *
 * @param {Array} arr - Input array
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Array of chunks
 */
function chunkArray(arr, size) {
    if (!Array.isArray(arr)) return [];
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// ============================================================
// Export
// ============================================================
module.exports = {
    generateOrderNumber,
    generateSlug,
    generateUniqueSlug,
    sanitizeFilename,
    formatCurrency,
    toCents,
    fromCents,
    stripHtml,
    truncateText,
    successResponse,
    paginatedResponse,
    errorResponse,
    getPaginationParams,
    isValidEmail,
    isValidUrl,
    isValidPhone,
    getDateRange,
    formatDate,
    uniqueArray,
    chunkArray,
};