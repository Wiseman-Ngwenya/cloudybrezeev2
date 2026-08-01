// ============================================================
// CloudyBreeze E-Commerce System
// Input Validation Middleware
// ============================================================
// Provides reusable validation rules and middleware for all
// API endpoints that accept user input.
//
// Uses express-validator for declarative validation chains.
// Validation errors are collected and formatted consistently.
// ============================================================

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');
const {
    VALIDATION,
    ORDER_STATUS_LIST,
    PAYMENT_STATUS_LIST,
    PAYMENT_METHOD_LIST,
} = require('../utils/constants');

// ============================================================
// Validation Result Handler
// ============================================================

/**
 * Process validation results and throw ValidationError if errors exist.
 * Must be called AFTER validation chains in the middleware pipeline.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function handleValidationResult(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
        }));

        throw new ValidationError(
            'Validation failed. Please check your input.',
            formattedErrors
        );
    }

    next();
}

// ============================================================
// Common Validation Rules
// ============================================================

const emailRule = body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: VALIDATION.EMAIL_MAX_LENGTH })
    .withMessage(`Email must not exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters`);

const nameRule = body('name')
    .trim()
    .isLength({ min: VALIDATION.NAME_MIN_LENGTH, max: VALIDATION.NAME_MAX_LENGTH })
    .withMessage(
        `Name must be between ${VALIDATION.NAME_MIN_LENGTH} and ${VALIDATION.NAME_MAX_LENGTH} characters`
    );

const phoneRule = body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[+\d][\d\s\-()]{4,19}$/)
    .withMessage('Please provide a valid phone number');

// ============================================================
// Product Validation Rules
// ============================================================

const productValidationRules = [
    body('name')
        .trim()
        .isLength({ min: VALIDATION.PRODUCT_NAME_MIN_LENGTH, max: VALIDATION.PRODUCT_NAME_MAX_LENGTH })
        .withMessage(
            `Product name must be between ${VALIDATION.PRODUCT_NAME_MIN_LENGTH} and ${VALIDATION.PRODUCT_NAME_MAX_LENGTH} characters`
        ),

    body('slug')
        .optional({ checkFalsy: true })
        .trim()
        .isSlug()
        .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
        .isLength({ max: VALIDATION.SLUG_MAX_LENGTH })
        .withMessage(`Slug must not exceed ${VALIDATION.SLUG_MAX_LENGTH} characters`),

    body('category_id')
        .optional({ checkFalsy: true })
        .isUUID(4)
        .withMessage('Category ID must be a valid UUID'),

    body('short_description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Short description must not exceed 500 characters'),

    body('description')
        .optional({ checkFalsy: true })
        .trim(),

    body('price')
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Price must be a valid decimal number')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number')
        .toFloat(),

    body('compare_price')
        .optional({ checkFalsy: true })
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Compare price must be a valid decimal number')
        .isFloat({ min: 0 })
        .withMessage('Compare price must be a positive number')
        .toFloat(),

    body('featured')
        .optional()
        .isBoolean()
        .withMessage('Featured must be a boolean value')
        .toBoolean(),

    body('active')
        .optional()
        .isBoolean()
        .withMessage('Active must be a boolean value')
        .toBoolean(),

    body('cover_image')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Cover image must be a valid URL'),
];

// ============================================================
// Category Validation Rules
// ============================================================

const categoryValidationRules = [
    body('name')
        .trim()
        .isLength({ min: VALIDATION.NAME_MIN_LENGTH, max: VALIDATION.NAME_MAX_LENGTH })
        .withMessage(
            `Category name must be between ${VALIDATION.NAME_MIN_LENGTH} and ${VALIDATION.NAME_MAX_LENGTH} characters`
        ),

    body('slug')
        .optional({ checkFalsy: true })
        .trim()
        .isSlug()
        .withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
        .isLength({ max: VALIDATION.SLUG_MAX_LENGTH })
        .withMessage(`Slug must not exceed ${VALIDATION.SLUG_MAX_LENGTH} characters`),

    body('description')
        .optional({ checkFalsy: true })
        .trim(),

    body('image_url')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Image URL must be a valid URL'),

    body('active')
        .optional()
        .isBoolean()
        .withMessage('Active must be a boolean value')
        .toBoolean(),

    body('sort_order')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Sort order must be a non-negative integer')
        .toInt(),
];

// ============================================================
// Order Validation Rules
// ============================================================

const orderValidationRules = [
    body('customer_name')
        .trim()
        .isLength({ min: VALIDATION.NAME_MIN_LENGTH, max: VALIDATION.NAME_MAX_LENGTH })
        .withMessage(
            `Name must be between ${VALIDATION.NAME_MIN_LENGTH} and ${VALIDATION.NAME_MAX_LENGTH} characters`
        ),

    body('customer_email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: VALIDATION.EMAIL_MAX_LENGTH })
        .withMessage(`Email must not exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters`),

    body('customer_phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[+\d][\d\s\-()]{4,19}$/)
        .withMessage('Please provide a valid phone number'),

    body('shipping_address')
        .trim()
        .isLength({ min: 5, max: VALIDATION.ADDRESS_MAX_LENGTH })
        .withMessage(
            `Shipping address must be between 5 and ${VALIDATION.ADDRESS_MAX_LENGTH} characters`
        ),

    body('shipping_city')
        .trim()
        .isLength({ min: 2, max: VALIDATION.CITY_MAX_LENGTH })
        .withMessage(
            `City must be between 2 and ${VALIDATION.CITY_MAX_LENGTH} characters`
        ),

    body('shipping_country')
        .trim()
        .isLength({ min: 2, max: VALIDATION.COUNTRY_MAX_LENGTH })
        .withMessage(
            `Country must be between 2 and ${VALIDATION.COUNTRY_MAX_LENGTH} characters`
        ),

    body('payment_method')
        .isIn(PAYMENT_METHOD_LIST)
        .withMessage(`Payment method must be one of: ${PAYMENT_METHOD_LIST.join(', ')}`),

    body('notes')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: VALIDATION.ORDER_NOTES_MAX_LENGTH })
        .withMessage(`Notes must not exceed ${VALIDATION.ORDER_NOTES_MAX_LENGTH} characters`),

    body('items')
        .isArray({ min: 1 })
        .withMessage('At least one item is required'),

    body('items.*.product_id')
        .isUUID(4)
        .withMessage('Product ID must be a valid UUID'),

    body('items.*.variant_id')
        .optional({ checkFalsy: true })
        .isUUID(4)
        .withMessage('Variant ID must be a valid UUID'),

    body('items.*.quantity')
        .isInt({ min: 1, max: 99 })
        .withMessage('Quantity must be between 1 and 99')
        .toInt(),
];

// ============================================================
// Contact Validation Rules
// ============================================================

const contactValidationRules = [
    body('name')
        .trim()
        .isLength({ min: VALIDATION.NAME_MIN_LENGTH, max: VALIDATION.NAME_MAX_LENGTH })
        .withMessage(
            `Name must be between ${VALIDATION.NAME_MIN_LENGTH} and ${VALIDATION.NAME_MAX_LENGTH} characters`
        ),

    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: VALIDATION.EMAIL_MAX_LENGTH })
        .withMessage(`Email must not exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters`),

    body('subject')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: VALIDATION.SUBJECT_MAX_LENGTH })
        .withMessage(`Subject must not exceed ${VALIDATION.SUBJECT_MAX_LENGTH} characters`),

    body('message')
        .trim()
        .isLength({ min: VALIDATION.MESSAGE_MIN_LENGTH, max: VALIDATION.MESSAGE_MAX_LENGTH })
        .withMessage(
            `Message must be between ${VALIDATION.MESSAGE_MIN_LENGTH} and ${VALIDATION.MESSAGE_MAX_LENGTH} characters`
        ),
];

// ============================================================
// Newsletter Validation Rules
// ============================================================

const newsletterValidationRules = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: VALIDATION.EMAIL_MAX_LENGTH })
        .withMessage(`Email must not exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters`),
];

// ============================================================
// Settings Validation Rules
// ============================================================

const settingsValidationRules = [
    body('store_name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Store name must be between 1 and 200 characters'),

    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('phone')
        .optional({ checkFalsy: true })
        .trim(),

    body('address')
        .optional({ checkFalsy: true })
        .trim(),

    body('currency')
        .optional()
        .trim()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code')
        .isUppercase()
        .withMessage('Currency must be uppercase'),

    body('shipping_cost')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Shipping cost must be a valid decimal number')
        .isFloat({ min: 0 })
        .withMessage('Shipping cost must be a positive number')
        .toFloat(),

    body('free_shipping_threshold')
        .optional({ checkFalsy: true })
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Free shipping threshold must be a valid decimal number')
        .isFloat({ min: 0 })
        .withMessage('Free shipping threshold must be a positive number')
        .toFloat(),

    body('facebook')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Facebook URL must be a valid URL'),

    body('instagram')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Instagram URL must be a valid URL'),

    body('twitter')
        .optional({ checkFalsy: true })
        .trim()
        .isURL()
        .withMessage('Twitter URL must be a valid URL'),

    body('seo_title')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 200 })
        .withMessage('SEO title must not exceed 200 characters'),

    body('seo_description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('SEO description must not exceed 500 characters'),
];

// ============================================================
// Order Status Update Validation Rules
// ============================================================

const orderStatusValidationRules = [
    body('status')
        .isIn(ORDER_STATUS_LIST)
        .withMessage(`Status must be one of: ${ORDER_STATUS_LIST.join(', ')}`),
];

// ============================================================
// Payment Status Update Validation Rules
// ============================================================

const paymentStatusValidationRules = [
    body('payment_status')
        .isIn(PAYMENT_STATUS_LIST)
        .withMessage(`Payment status must be one of: ${PAYMENT_STATUS_LIST.join(', ')}`),
];

// ============================================================
// UUID Parameter Validation
// ============================================================

const uuidParam = (paramName = 'id') =>
    param(paramName)
        .isUUID(4)
        .withMessage(`${paramName} must be a valid UUID`);

// ============================================================
// Export
// ============================================================
module.exports = {
    handleValidationResult,
    emailRule,
    nameRule,
    phoneRule,
    productValidationRules,
    categoryValidationRules,
    orderValidationRules,
    contactValidationRules,
    newsletterValidationRules,
    settingsValidationRules,
    orderStatusValidationRules,
    paymentStatusValidationRules,
    uuidParam,
};