// ============================================================
// CloudyBreeze E-Commerce System
// Category Controller
// ============================================================
// Handles HTTP request/response for category operations.
//
// Responsibilities:
// - Parse request inputs
// - Call category service layer
// - Format and send responses
// - No business logic (delegated to categoryService)
// ============================================================

const categoryService = require('../services/categoryService');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * GET /api/categories
 *
 * Get all active categories for public display.
 * Returns: Array of categories ordered by sort_order
 */
const getAllCategories = asyncHandler(async (req, res) => {
    const categories = await categoryService.getAllCategories();

    res.status(200).json(
        successResponse(categories)
    );
});

/**
 * GET /api/categories/:slug
 *
 * Get a single active category by slug.
 * Returns: Category object
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const category = await categoryService.getCategoryBySlug(slug);

    res.status(200).json(
        successResponse(category)
    );
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/categories
 *
 * Get all categories for admin management.
 * Includes inactive categories.
 * Returns: Array of all categories ordered by sort_order
 */
const adminGetAllCategories = asyncHandler(async (req, res) => {
    const categories = await categoryService.adminGetAllCategories();

    res.status(200).json(
        successResponse(categories)
    );
});

/**
 * GET /api/admin/categories/:id
 *
 * Get a single category by ID for admin.
 * Includes inactive categories.
 * Returns: Category object
 */
const adminGetCategoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await categoryService.adminGetCategoryById(id);

    res.status(200).json(
        successResponse(category)
    );
});

/**
 * POST /api/admin/categories
 *
 * Create a new category.
 * Body: { name, slug?, description?, image_url?, active?, sort_order? }
 * Returns: Created category object
 */
const createCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body);

    res.status(201).json(
        successResponse(category, 'Category created successfully.')
    );
});

/**
 * PUT /api/admin/categories/:id
 *
 * Update an existing category.
 * Body: { name?, slug?, description?, image_url?, active?, sort_order? }
 * Returns: Updated category object
 */
const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await categoryService.updateCategory(id, req.body);

    res.status(200).json(
        successResponse(category, 'Category updated successfully.')
    );
});

/**
 * DELETE /api/admin/categories/:id
 *
 * Delete a category.
 * Products in this category will have category_id set to NULL.
 * Returns: { deleted: true, id }
 */
const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await categoryService.deleteCategory(id);

    res.status(200).json(
        successResponse(result, 'Category deleted successfully.')
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    getAllCategories,
    getCategoryBySlug,
    adminGetAllCategories,
    adminGetCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};