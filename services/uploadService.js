// ============================================================
// CloudyBreeze E-Commerce System
// Upload Service
// ============================================================
// Handles image upload to Supabase Storage.
//
// Responsibilities:
// - Validate file type, size, and dimensions
// - Sanitize and generate unique filename
// - Upload to Supabase Storage
// - Return public URL for database storage
// ============================================================

const sharp = require('sharp');
const { serviceClient, STORAGE_BUCKET } = require('../config/supabase');
const { sanitizeFilename } = require('../utils/helpers');
const { UPLOAD_CONFIG } = require('../utils/constants');
const { BadRequestError, InternalServerError } = require('../middleware/errorHandler');

// ============================================================
// Image Validation
// ============================================================

/**
 * Validate uploaded image dimensions.
 * Checks that width and height are within allowed ranges.
 *
 * @param {Buffer} fileBuffer - Raw file buffer
 * @returns {Promise<Object>} Image metadata (width, height, format)
 * @throws {BadRequestError} If dimensions are out of range
 */
async function validateImageDimensions(fileBuffer) {
    let metadata;

    try {
        metadata = await sharp(fileBuffer).metadata();
    } catch (err) {
        throw new BadRequestError(
            'Unable to process image. The file may be corrupted or not a valid image.'
        );
    }

    const { width, height, format } = metadata;

    if (!width || !height) {
        throw new BadRequestError(
            'Unable to determine image dimensions. Please upload a valid image file.'
        );
    }

    // Check minimum dimensions
    if (width < UPLOAD_CONFIG.MIN_DIMENSIONS.width || height < UPLOAD_CONFIG.MIN_DIMENSIONS.height) {
        throw new BadRequestError(
            `Image dimensions are too small. Minimum: ${UPLOAD_CONFIG.MIN_DIMENSIONS.width}x${UPLOAD_CONFIG.MIN_DIMENSIONS.height}px. ` +
            `Uploaded: ${width}x${height}px.`
        );
    }

    // Check maximum dimensions
    if (width > UPLOAD_CONFIG.MAX_DIMENSIONS.width || height > UPLOAD_CONFIG.MAX_DIMENSIONS.height) {
        throw new BadRequestError(
            `Image dimensions are too large. Maximum: ${UPLOAD_CONFIG.MAX_DIMENSIONS.width}x${UPLOAD_CONFIG.MAX_DIMENSIONS.height}px. ` +
            `Uploaded: ${width}x${height}px.`
        );
    }

    return { width, height, format };
}

// ============================================================
// File Validation
// ============================================================

/**
 * Validate uploaded file before processing.
 * Checks that file exists and has content.
 *
 * @param {Object} file - Multer file object
 * @throws {BadRequestError} If file is missing or empty
 */
function validateFile(file) {
    if (!file) {
        throw new BadRequestError('No file provided. Please select an image to upload.');
    }

    if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestError('The uploaded file is empty. Please select a valid image.');
    }
}

// ============================================================
// Upload Operations
// ============================================================

/**
 * Upload a single image to Supabase Storage.
 *
 * Flow:
 * 1. Validate file exists
 * 2. Validate image dimensions
 * 3. Sanitize filename
 * 4. Upload to Supabase Storage
 * 5. Return public URL
 *
 * @param {Object} file - Multer file object
 * @param {string} [folder='covers'] - Storage folder path
 * @returns {Promise<Object>} Uploaded file info { url, path, filename }
 * @throws {BadRequestError} If validation fails
 * @throws {InternalServerError} If upload fails
 */
async function uploadImage(file, folder = UPLOAD_CONFIG.STORAGE_PATH_COVERS) {
    // Validate file exists
    validateFile(file);

    // Validate dimensions
    await validateImageDimensions(file.buffer);

    // Sanitize filename
    const uniqueFilename = sanitizeFilename(file.originalname);

    // Build storage path
    const storagePath = `${folder}/${uniqueFilename}`;

    // Upload to Supabase Storage
    const { data, error } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '31536000', // 1 year cache
            upsert: false,
        });

    if (error) {
        console.error('Supabase Storage upload error:', error);

        // Handle specific storage errors
        if (error.message && error.message.includes('duplicate')) {
            throw new BadRequestError(
                'A file with this name already exists. Please rename the file and try again.'
            );
        }

        if (error.message && error.message.includes('bucket')) {
            throw new InternalServerError(
                'Storage configuration error. Please contact the administrator.'
            );
        }

        throw new InternalServerError(
            'Failed to upload image to storage. Please try again.'
        );
    }

    // Get public URL
    const { data: publicUrlData } = serviceClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

    return {
        url: publicUrlData.publicUrl,
        path: storagePath,
        filename: uniqueFilename,
    };
}

/**
 * Upload multiple images to Supabase Storage.
 * Processes each file through the single upload pipeline.
 *
 * @param {Array<Object>} files - Array of multer file objects
 * @param {string} [folder='gallery'] - Storage folder path
 * @returns {Promise<Array<Object>>} Array of uploaded file info
 */
async function uploadMultipleImages(files, folder = UPLOAD_CONFIG.STORAGE_PATH_GALLERY) {
    if (!files || files.length === 0) {
        throw new BadRequestError('No files provided. Please select at least one image.');
    }

    const uploadPromises = files.map((file) => uploadImage(file, folder));

    // Process all uploads and collect results
    // If any upload fails, the error will propagate
    const results = await Promise.all(uploadPromises);

    return results;
}

/**
 * Delete an image from Supabase Storage.
 *
 * @param {string} storagePath - Full path of the file in storage
 * @returns {Promise<Object>} Deletion result
 */
async function deleteImage(storagePath) {
    if (!storagePath) {
        throw new BadRequestError('No file path provided for deletion.');
    }

    // Prevent path traversal attacks
    if (storagePath.includes('..') || storagePath.includes('//')) {
        throw new BadRequestError('Invalid file path.');
    }

    const { data, error } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

    if (error) {
        console.error('Supabase Storage delete error:', error);

        if (error.message && error.message.includes('not found')) {
            throw new BadRequestError(
                'File not found in storage. It may have already been deleted.'
            );
        }

        throw new InternalServerError(
            'Failed to delete image from storage. Please try again.'
        );
    }

    return { deleted: true, path: storagePath };
}

/**
 * Move/rename an image in Supabase Storage.
 * Used when updating product images or reorganizing folders.
 *
 * @param {string} sourcePath - Current file path
 * @param {string} destinationPath - New file path
 * @returns {Promise<Object>} Move result with new public URL
 */
async function moveImage(sourcePath, destinationPath) {
    if (!sourcePath || !destinationPath) {
        throw new BadRequestError('Source and destination paths are required.');
    }

    if (sourcePath.includes('..') || destinationPath.includes('..')) {
        throw new BadRequestError('Invalid file path.');
    }

    // Supabase Storage move operation
    const { data, error } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .move(sourcePath, destinationPath);

    if (error) {
        console.error('Supabase Storage move error:', error);

        if (error.message && error.message.includes('not found')) {
            throw new BadRequestError(
                'Source file not found in storage.'
            );
        }

        throw new InternalServerError(
            'Failed to move image in storage. Please try again.'
        );
    }

    // Get new public URL
    const { data: publicUrlData } = serviceClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(destinationPath);

    return {
        url: publicUrlData.publicUrl,
        path: destinationPath,
    };
}

// ============================================================
// Export
// ============================================================
module.exports = {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    moveImage,
    validateImageDimensions,
};