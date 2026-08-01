// ============================================================
// CloudyBreeze E-Commerce System
// File Upload Middleware
// ============================================================
// Configures multer for temporary file storage.
// Actual validation (type, size, dimensions) and Supabase
// upload is handled by uploadService.js.
//
// This middleware handles:
// - Memory storage for temporary file buffering
// - File size limit enforcement
// - File count limit enforcement
// ============================================================

const multer = require('multer');
const path = require('path');
const { BadRequestError } = require('./errorHandler');
const { UPLOAD_CONFIG } = require('../utils/constants');

// ============================================================
// Multer Configuration
// ============================================================

/**
 * Memory storage - Files are stored in memory as Buffer objects.
 * This avoids writing temp files to disk and simplifies cleanup.
 * Files are passed to uploadService for processing and Supabase upload.
 */
const storage = multer.memoryStorage();

// ============================================================
// File Filter
// ============================================================

/**
 * Filter uploaded files by MIME type.
 * Only allows: image/jpeg, image/png, image/webp
 *
 * @param {Object} req - Express request object
 * @param {Object} file - File object from multer
 * @param {Function} cb - Callback function
 */
function fileFilter(req, file, cb) {
    const allowedMimeTypes = UPLOAD_CONFIG.ALLOWED_MIME_TYPES;

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const allowedExtensions = UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ');
        cb(
            new BadRequestError(
                `Invalid file type: ${file.mimetype}. Allowed types: ${allowedExtensions}`
            ),
            false
        );
    }
}

// ============================================================
// Multer Instance
// ============================================================

/**
 * Configured multer instance for single image uploads.
 *
 * Limits:
 * - File size: 5 MB (5,242,880 bytes)
 * - Files per request: 1
 */
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE, // 5 MB
        files: 1,
    },
});

// ============================================================
// Upload Middleware Wrappers
// ============================================================

/**
 * Middleware for single image upload.
 * Expects form field name: "image"
 *
 * Usage: router.post('/upload', uploadSingleImage, uploadController.uploadImage)
 */
const uploadSingleImage = upload.single('image');

/**
 * Middleware for multiple image uploads.
 * Expects form field name: "images"
 * Maximum files determined by multer limits (currently 1, adjust if needed)
 *
 * Usage: router.post('/upload/multiple', uploadMultipleImages, uploadController.uploadMultipleImages)
 */
const uploadMultipleImages = upload.array('images', 10);

// ============================================================
// Upload Error Handler
// ============================================================

/**
 * Wraps multer middleware to catch and format multer errors.
 * Multer errors are thrown as MulterError instances.
 * This wrapper catches them and passes to the centralized error handler.
 *
 * @param {Function} multerMiddleware - Multer middleware function
 * @returns {Function} Express middleware with error handling
 */
function handleUpload(multerMiddleware) {
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (err) {
                // Multer-specific errors
                if (err instanceof multer.MulterError) {
                    switch (err.code) {
                        case 'LIMIT_FILE_SIZE':
                            return next(
                                new BadRequestError(
                                    `File size exceeds the maximum allowed size of ${UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB`
                                )
                            );
                        case 'LIMIT_FILE_COUNT':
                            return next(
                                new BadRequestError(
                                    'Too many files uploaded. Only one file is allowed per request.'
                                )
                            );
                        case 'LIMIT_UNEXPECTED_FILE':
                            return next(
                                new BadRequestError(
                                    `Unexpected file field: "${err.field}". Expected field name: "image"`
                                )
                            );
                        default:
                            return next(
                                new BadRequestError(
                                    `File upload error: ${err.message}`
                                )
                            );
                    }
                }

                // Custom file filter errors (BadRequestError)
                if (err instanceof BadRequestError) {
                    return next(err);
                }

                // Unknown errors
                return next(
                    new BadRequestError('File upload failed due to an unexpected error')
                );
            }

            next();
        });
    };
}

// ============================================================
// Export
// ============================================================
module.exports = {
    uploadSingleImage,
    uploadMultipleImages,
    handleUpload,
};