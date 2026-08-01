// ============================================================
// CloudyBreeze E-Commerce System
// Application Constants
// ============================================================
// Central location for all magic numbers, strings, and
// configuration values used throughout the application.
// ============================================================

// ============================================================
// Order Statuses
// ============================================================
const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
};

const ORDER_STATUS_LIST = Object.values(ORDER_STATUS);

// ============================================================
// Payment Statuses
// ============================================================
const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
};

const PAYMENT_STATUS_LIST = Object.values(PAYMENT_STATUS);

// ============================================================
// Payment Methods
// ============================================================
const PAYMENT_METHOD = {
    BANK_TRANSFER: 'bank_transfer',
    PAYPAL: 'paypal',
};

const PAYMENT_METHOD_LIST = Object.values(PAYMENT_METHOD);

// ============================================================
// User Roles
// ============================================================
const USER_ROLE = {
    ADMIN: 'admin',
};

// ============================================================
// Order Number Configuration
// ============================================================
const ORDER_NUMBER_PREFIX = 'CB-';
const ORDER_NUMBER_PAD_LENGTH = 6;

// ============================================================
// Image Upload Configuration
// ============================================================
const UPLOAD_CONFIG = {
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB in bytes
    MIN_DIMENSIONS: { width: 600, height: 600 },
    MAX_DIMENSIONS: { width: 4000, height: 4000 },
    RECOMMENDED_DIMENSIONS: { width: 1200, height: 1200 },
    STORAGE_BUCKET: 'product-images',
    STORAGE_PATH_COVERS: 'covers',
    STORAGE_PATH_GALLERY: 'gallery',
    STORAGE_PATH_VARIANTS: 'variants',
    STORAGE_PATH_CATEGORIES: 'categories',
};

// ============================================================
// Pagination Configuration
// ============================================================
const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    PRODUCTS_PER_PAGE: 12,
    ORDERS_PER_PAGE: 20,
    ADMIN_PRODUCTS_PER_PAGE: 20,
    ADMIN_ORDERS_PER_PAGE: 20,
    ADMIN_CONTACTS_PER_PAGE: 20,
    ADMIN_SUBSCRIBERS_PER_PAGE: 20,
};

// ============================================================
// Rate Limiting
// ============================================================
const RATE_LIMIT = {
    GLOBAL_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    GLOBAL_MAX_REQUESTS: 100,
    AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    AUTH_MAX_REQUESTS: 10,
    CONTACT_WINDOW_MS: 60 * 60 * 1000, // 1 hour
    CONTACT_MAX_REQUESTS: 5,
    NEWSLETTER_WINDOW_MS: 60 * 60 * 1000, // 1 hour
    NEWSLETTER_MAX_REQUESTS: 5,
};

// ============================================================
// Shipping Configuration
// ============================================================
const SHIPPING = {
    DEFAULT_COST: 5.00,
    FREE_SHIPPING_THRESHOLD: null, // Will be overridden by store settings
};

// ============================================================
// Currency Configuration
// ============================================================
const CURRENCY = {
    DEFAULT: 'USD',
    SYMBOL: '$',
    DECIMAL_PLACES: 2,
};

// ============================================================
// Validation Rules
// ============================================================
const VALIDATION = {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    EMAIL_MAX_LENGTH: 255,
    PHONE_MAX_LENGTH: 20,
    SUBJECT_MAX_LENGTH: 200,
    MESSAGE_MIN_LENGTH: 10,
    MESSAGE_MAX_LENGTH: 5000,
    PRODUCT_NAME_MIN_LENGTH: 2,
    PRODUCT_NAME_MAX_LENGTH: 200,
    SLUG_MAX_LENGTH: 200,
    SKU_MAX_LENGTH: 50,
    VARIATION_NAME_MAX_LENGTH: 100,
    ORDER_NOTES_MAX_LENGTH: 1000,
    ADDRESS_MAX_LENGTH: 500,
    CITY_MAX_LENGTH: 100,
    COUNTRY_MAX_LENGTH: 100,
};

// ============================================================
// Cache Configuration
// ============================================================
const CACHE = {
    STORE_SETTINGS_TTL: 5 * 60 * 1000, // 5 minutes
    CATEGORIES_TTL: 5 * 60 * 1000, // 5 minutes
    FEATURED_PRODUCTS_TTL: 2 * 60 * 1000, // 2 minutes
};

// ============================================================
// Analytics
// ============================================================
const ANALYTICS = {
    TOP_PRODUCTS_LIMIT: 10,
    TOP_COUNTRIES_LIMIT: 10,
    TOP_PAGES_LIMIT: 10,
    RECENT_VISITORS_LIMIT: 50,
};

// ============================================================
// Export
// ============================================================
module.exports = {
    ORDER_STATUS,
    ORDER_STATUS_LIST,
    PAYMENT_STATUS,
    PAYMENT_STATUS_LIST,
    PAYMENT_METHOD,
    PAYMENT_METHOD_LIST,
    USER_ROLE,
    ORDER_NUMBER_PREFIX,
    ORDER_NUMBER_PAD_LENGTH,
    UPLOAD_CONFIG,
    PAGINATION,
    RATE_LIMIT,
    SHIPPING,
    CURRENCY,
    VALIDATION,
    CACHE,
    ANALYTICS,
};