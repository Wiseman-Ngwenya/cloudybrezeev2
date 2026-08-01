// ============================================================
// CloudyBreeze E-Commerce System
// Centralized Error Handling Middleware
// ============================================================
// This middleware catches all errors thrown in the application
// and returns standardized error responses.
//
// All errors flow through this single handler to ensure
// consistent API responses regardless of error origin.
// ============================================================

const { errorResponse } = require('../utils/helpers');

// ============================================================
// Custom Error Classes
// ============================================================

/**
 * BadRequestError - 400
 * Used for validation errors, malformed requests
 */
class BadRequestError extends Error {
    constructor(message = 'Bad request') {
        super(message);
        this.name = 'BadRequestError';
        this.statusCode = 400;
        this.code = 'BAD_REQUEST';
    }
}

/**
 * UnauthorizedError - 401
 * Used when authentication is missing or invalid
 */
class UnauthorizedError extends Error {
    constructor(message = 'Authentication required') {
        super(message);
        this.name = 'UnauthorizedError';
        this.statusCode = 401;
        this.code = 'UNAUTHORIZED';
    }
}

/**
 * ForbiddenError - 403
 * Used when user does not have sufficient permissions
 */
class ForbiddenError extends Error {
    constructor(message = 'Access denied') {
        super(message);
        this.name = 'ForbiddenError';
        this.statusCode = 403;
        this.code = 'FORBIDDEN';
    }
}

/**
 * NotFoundError - 404
 * Used when a requested resource does not exist
 */
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
        this.code = 'NOT_FOUND';
    }
}

/**
 * ConflictError - 409
 * Used for duplicate entries or state conflicts
 */
class ConflictError extends Error {
    constructor(message = 'Resource conflict') {
        super(message);
        this.name = 'ConflictError';
        this.statusCode = 409;
        this.code = 'CONFLICT';
    }
}

/**
 * ValidationError - 422
 * Used for input validation failures
 */
class ValidationError extends Error {
    constructor(message = 'Validation failed', errors = []) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 422;
        this.code = 'VALIDATION_ERROR';
        this.errors = errors;
    }
}

/**
 * TooManyRequestsError - 429
 * Used for rate limit violations
 */
class TooManyRequestsError extends Error {
    constructor(message = 'Too many requests') {
        super(message);
        this.name = 'TooManyRequestsError';
        this.statusCode = 429;
        this.code = 'TOO_MANY_REQUESTS';
    }
}

/**
 * InternalServerError - 500
 * Used for unexpected server errors
 */
class InternalServerError extends Error {
    constructor(message = 'Internal server error') {
        super(message);
        this.name = 'InternalServerError';
        this.statusCode = 500;
        this.code = 'INTERNAL_SERVER_ERROR';
    }
}

/**
 * ServiceUnavailableError - 503
 * Used when external services are unavailable
 */
class ServiceUnavailableError extends Error {
    constructor(message = 'Service temporarily unavailable') {
        super(message);
        this.name = 'ServiceUnavailableError';
        this.statusCode = 503;
        this.code = 'SERVICE_UNAVAILABLE';
    }
}

// ============================================================
// Supabase Error Mapper
// ============================================================

/**
 * Map Supabase error codes to appropriate HTTP errors.
 *
 * @param {Object} supabaseError - Error object from Supabase
 * @returns {Error} Mapped application error
 */
function mapSupabaseError(supabaseError) {
    if (!supabaseError) {
        return new InternalServerError('An unexpected database error occurred');
    }

    const { code, message, details } = supabaseError;

    // PostgreSQL error codes
    switch (code) {
        // Unique constraint violation
        case '23505':
            return new ConflictError(
                message || 'A record with that value already exists'
            );

        // Foreign key violation
        case '23503':
            return new BadRequestError(
                message || 'Referenced record does not exist'
            );

        // Check constraint violation
        case '23514':
            return new BadRequestError(
                message || 'Value does not meet required constraints'
            );

        // Not null violation
        case '23502':
            return new BadRequestError(
                message || 'A required field is missing'
            );

        // Insufficient privileges / RLS violation
        case '42501':
            return new ForbiddenError(
                'You do not have permission to perform this action'
            );

        // Connection errors
        case '08000':
        case '08003':
        case '08006':
        case '57P01':
            return new ServiceUnavailableError(
                'Database service is temporarily unavailable'
            );

        // Authentication errors from Supabase Auth
        case 'OTP_ERROR':
        case 'INVALID_CREDENTIALS':
            return new UnauthorizedError(
                message || 'Invalid email or password'
            );

        // Rate limit from Supabase Auth
        case 'OVER_EMAIL_SEND_RATE_LIMIT':
        case 'OVER_SMS_SEND_RATE_LIMIT':
            return new TooManyRequestsError(
                'Too many requests. Please try again later.'
            );

        // Default - Internal server error
        default:
            console.error('Supabase Error:', { code, message, details });
            return new InternalServerError(
                'An unexpected error occurred with the database'
            );
    }
}

// ============================================================
// Multer Error Mapper
// ============================================================

/**
 * Map Multer upload errors to appropriate HTTP errors.
 *
 * @param {Object} multerError - Error object from Multer
 * @returns {Error} Mapped application error
 */
function mapMulterError(multerError) {
    switch (multerError.code) {
        case 'LIMIT_FILE_SIZE':
            return new BadRequestError(
                'File size exceeds the maximum allowed size of 5 MB'
            );

        case 'LIMIT_FILE_COUNT':
            return new BadRequestError(
                'Too many files uploaded at once'
            );

        case 'LIMIT_UNEXPECTED_FILE':
            return new BadRequestError(
                'Unexpected file field name'
            );

        case 'LIMIT_FIELD_KEY':
        case 'LIMIT_FIELD_VALUE':
        case 'LIMIT_FIELD_COUNT':
            return new BadRequestError(
                'Form data exceeds allowed limits'
            );

        default:
            return new BadRequestError(
                multerError.message || 'File upload failed'
            );
    }
}

// ============================================================
// Error Handler Middleware
// ============================================================

/**
 * Express error handling middleware.
 * Must have 4 parameters for Express to recognize as error handler.
 *
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
    // Determine if this is a known application error
    const isKnownError =
        err.statusCode !== undefined && err.code !== undefined;

    let error = err;

    // Map Supabase errors
    if (!isKnownError && err.__isSupabaseError) {
        error = mapSupabaseError(err);
    }

    // Map Multer errors
    if (!isKnownError && err.code && err.code.startsWith('LIMIT_')) {
        error = mapMulterError(err);
    }

    // Fall back to generic errors for known HTTP statuses
    if (!isKnownError && !error.statusCode) {
        switch (err.status || err.statusCode) {
            case 400:
                error = new BadRequestError(err.message);
                break;
            case 401:
                error = new UnauthorizedError(err.message);
                break;
            case 403:
                error = new ForbiddenError(err.message);
                break;
            case 404:
                error = new NotFoundError(err.message);
                break;
            case 409:
                error = new ConflictError(err.message);
                break;
            case 422:
                error = new ValidationError(err.message);
                break;
            case 429:
                error = new TooManyRequestsError(err.message);
                break;
            default:
                break;
        }
    }

    // If still no known error, wrap as internal server error
    if (!error.statusCode) {
        console.error('Unhandled Error:', {
            name: err.name,
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            url: req.originalUrl,
            method: req.method,
            body: req.body ? JSON.stringify(req.body).substring(0, 500) : undefined,
        });

        error = new InternalServerError(
            process.env.NODE_ENV === 'development'
                ? err.message || 'An unexpected error occurred'
                : 'An unexpected error occurred'
        );
    }

    // Log non-trivial errors
    if (error.statusCode >= 500) {
        console.error(`[${error.code}] ${error.message}`);
        if (process.env.NODE_ENV === 'development' && err.stack) {
            console.error(err.stack);
        }
    }

    // Build response
    const response = errorResponse(error.code, error.message);

    // Include validation errors if available
    if (error.errors && error.errors.length > 0) {
        response.error.details = error.errors;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.error.stack = err.stack;
    }

    // Send response
    res.status(error.statusCode).json(response);
}

// ============================================================
// Async Handler Wrapper
// ============================================================

/**
 * Wrap async route handlers to catch promise rejections.
 * Eliminates the need for try/catch blocks in every controller.
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that forwards errors to next()
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            // Tag Supabase errors for mapping
            if (err.__isSupabaseError === undefined && err.code && err.details !== undefined) {
                err.__isSupabaseError = true;
            }
            next(err);
        });
    };
}

// ============================================================
// Export
// ============================================================
module.exports = errorHandler;
module.exports.BadRequestError = BadRequestError;
module.exports.UnauthorizedError = UnauthorizedError;
module.exports.ForbiddenError = ForbiddenError;
module.exports.NotFoundError = NotFoundError;
module.exports.ConflictError = ConflictError;
module.exports.ValidationError = ValidationError;
module.exports.TooManyRequestsError = TooManyRequestsError;
module.exports.InternalServerError = InternalServerError;
module.exports.ServiceUnavailableError = ServiceUnavailableError;
module.exports.mapSupabaseError = mapSupabaseError;
module.exports.mapMulterError = mapMulterError;
module.exports.asyncHandler = asyncHandler;