// ============================================================
// CloudyBreeze E-Commerce System
// Upload Routes
// ============================================================
// Defines routes for file upload operations.
// All routes are admin-only, mounted at /api/admin/upload
// ============================================================

const express = require('express');
const router = express.Router();

const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');
const { uploadSingleImage, uploadMultipleImages, handleUpload } = require('../middleware/upload');
const { body } = require('express-validator');
const { handleValidationResult } = require('../middleware/validate');

// ============================================================
// All routes require authentication
// ============================================================
router.use(authenticate);

// ============================================================
// Validation Rules
// ============================================================

const deleteValidation = [
    body('path')
        .trim()
        .notEmpty()
        .withMessage('File path is required for deletion')
        .isString()
        .withMessage('File path must be a string'),

    handleValidationResult,
];

// ============================================================
// Routes
// ============================================================

// POST /api/admin/upload
// Upload a single image
// Form data: image (file), folder (optional query param)
router.post(
    '/',
    handleUpload(uploadSingleImage),
    uploadController.uploadImage
);

// POST /api/admin/upload/multiple
// Upload multiple images
// Form data: images (files), folder (optional query param)
router.post(
    '/multiple',
    handleUpload(uploadMultipleImages),
    uploadController.uploadMultipleImages
);

// DELETE /api/admin/upload
// Delete an image from storage
// Body: { path }
router.delete(
    '/',
    deleteValidation,
    uploadController.deleteImage
);

// ============================================================
// Export
// ============================================================
module.exports = router;