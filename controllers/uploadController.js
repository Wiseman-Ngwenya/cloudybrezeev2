// ============================================================
// CloudyBreeze E-Commerce System
// Upload Controller
// ============================================================
// Handles HTTP request/response for file upload operations.
//
// Responsibilities:
// - Receive uploaded files from multer middleware
// - Call upload service layer
// - Format and send responses with public URLs
// - No business logic (delegated to uploadService)
// ============================================================

const uploadService = require('../services/uploadService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');
const { BadRequestError } = require('../middleware/errorHandler');

// ============================================================
// Admin Controllers
// ============================================================

/**
 * POST /api/admin/upload
 *
 * Upload a single image to Supabase Storage.
 * Expects multipart/form-data with field name "image".
 * Query params: folder (optional) - 'covers', 'gallery', 'variants', 'categories'
 * Returns: { url, path, filename }
 */
const uploadImage = asyncHandler(async (req, res) => {
    // File should be attached by multer middleware
    const file = req.file;

    if (!file) {
        throw new BadRequestError('No image file provided. Please select an image to upload.');
    }

    // Optional folder parameter for organizing uploads
    const folder = req.query.folder || 'covers';

    const result = await uploadService.uploadImage(file, folder);

    res.status(201).json(
        successResponse(result, 'Image uploaded successfully.')
    );
});

/**
 * POST /api/admin/upload/multiple
 *
 * Upload multiple images to Supabase Storage.
 * Expects multipart/form-data with field name "images".
 * Query params: folder (optional) - defaults to 'gallery'
 * Returns: Array of { url, path, filename }
 */
const uploadMultipleImages = asyncHandler(async (req, res) => {
    const files = req.files;

    if (!files || files.length === 0) {
        throw new BadRequestError('No image files provided. Please select at least one image.');
    }

    const folder = req.query.folder || 'gallery';

    const results = await uploadService.uploadMultipleImages(files, folder);

    res.status(201).json(
        successResponse(results, `${results.length} image(s) uploaded successfully.`)
    );
});

/**
 * DELETE /api/admin/upload
 *
 * Delete an image from Supabase Storage.
 * Body: { path } - Full storage path of the file
 * Returns: { deleted: true, path }
 */
const deleteImage = asyncHandler(async (req, res) => {
    const { path } = req.body;

    if (!path) {
        throw new BadRequestError('File path is required for deletion.');
    }

    const result = await uploadService.deleteImage(path);

    res.status(200).json(
        successResponse(result, 'Image deleted successfully.')
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
};