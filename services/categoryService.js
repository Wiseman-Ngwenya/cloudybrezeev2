// ============================================================
// CloudyBreeze E-Commerce System
// Category Service
// ============================================================
// Handles all category business logic.
//
// Responsibilities:
// - CRUD operations for categories
// - Slug generation and uniqueness validation
// - Public vs admin query separation
// - Category-product relationship management
// ============================================================

const { serviceClient } = require('../config/supabase');
const { generateSlug, generateUniqueSlug } = require('../utils/helpers');
const { NotFoundError, ConflictError, BadRequestError } = require('../middleware/errorHandler');

// ============================================================
// Public Queries
// ============================================================

/**
 * Get all active categories for public display.
 * Ordered by sort_order ascending.
 *
 * @returns {Promise<Array>} Array of active categories
 */
async function getAllCategories() {
    const { data, error } = await serviceClient
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching categories:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single active category by slug for public display.
 *
 * @param {string} slug - Category slug
 * @returns {Promise<Object>} Category object
 * @throws {NotFoundError} If category not found or inactive
 */
async function getCategoryBySlug(slug) {
    const { data, error } = await serviceClient
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single();

    if (error || !data) {
        throw new NotFoundError(`Category "${slug}" not found.`);
    }

    return data;
}

/**
 * Get a single active category by ID for public display.
 *
 * @param {string} id - Category UUID
 * @returns {Promise<Object>} Category object
 * @throws {NotFoundError} If category not found or inactive
 */
async function getCategoryById(id) {
    const { data, error } = await serviceClient
        .from('categories')
        .select('*')
        .eq('id', id)
        .eq('active', true)
        .single();

    if (error || !data) {
        throw new NotFoundError('Category not found.');
    }

    return data;
}

// ============================================================
// Admin Queries
// ============================================================

/**
 * Get all categories for admin management.
 * Includes inactive categories.
 * Ordered by sort_order ascending.
 *
 * @returns {Promise<Array>} Array of all categories
 */
async function adminGetAllCategories() {
    const { data, error } = await serviceClient
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching admin categories:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single category by ID for admin.
 * Includes inactive categories.
 *
 * @param {string} id - Category UUID
 * @returns {Promise<Object>} Category object
 * @throws {NotFoundError} If category not found
 */
async function adminGetCategoryById(id) {
    const { data, error } = await serviceClient
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        throw new NotFoundError('Category not found.');
    }

    return data;
}

// ============================================================
// Create
// ============================================================

/**
 * Create a new category.
 *
 * @param {Object} categoryData - Category fields
 * @param {string} categoryData.name - Category name (required)
 * @param {string} [categoryData.slug] - URL slug (auto-generated if not provided)
 * @param {string} [categoryData.description] - Category description
 * @param {string} [categoryData.image_url] - Category image URL
 * @param {boolean} [categoryData.active] - Active status (default: true)
 * @param {number} [categoryData.sort_order] - Display order (default: 0)
 * @returns {Promise<Object>} Created category
 * @throws {ConflictError} If slug already exists
 */
async function createCategory(categoryData) {
    const { name, slug, description, image_url, active, sort_order } = categoryData;

    // Generate slug if not provided
    let categorySlug = slug || generateSlug(name);

    // Check if slug already exists
    const { data: existingSlug } = await serviceClient
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();

    if (existingSlug) {
        // If slug was provided by user, throw conflict error
        if (slug) {
            throw new ConflictError(
                `A category with the slug "${slug}" already exists. Please choose a different slug.`
            );
        }
        // If slug was auto-generated, append unique identifier
        categorySlug = generateUniqueSlug(name);
    }

    const { data, error } = await serviceClient
        .from('categories')
        .insert({
            name,
            slug: categorySlug,
            description: description || null,
            image_url: image_url || null,
            active: active !== undefined ? active : true,
            sort_order: sort_order || 0,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating category:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Update
// ============================================================

/**
 * Update an existing category.
 *
 * @param {string} id - Category UUID
 * @param {Object} categoryData - Fields to update
 * @returns {Promise<Object>} Updated category
 * @throws {NotFoundError} If category not found
 * @throws {ConflictError} If new slug conflicts with existing
 */
async function updateCategory(id, categoryData) {
    // Verify category exists
    await adminGetCategoryById(id);

    const { name, slug, description, image_url, active, sort_order } = categoryData;

    // Build update object with only provided fields
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (image_url !== undefined) updates.image_url = image_url;
    if (active !== undefined) updates.active = active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    // Handle slug update with uniqueness check
    if (slug !== undefined) {
        const { data: existingSlug } = await serviceClient
            .from('categories')
            .select('id')
            .eq('slug', slug)
            .neq('id', id)
            .maybeSingle();

        if (existingSlug) {
            throw new ConflictError(
                `A category with the slug "${slug}" already exists. Please choose a different slug.`
            );
        }
        updates.slug = slug;
    } else if (name !== undefined) {
        // If name changed but slug not explicitly set, regenerate slug
        updates.slug = generateSlug(name);

        // Check if regenerated slug conflicts
        const { data: existingAutoSlug } = await serviceClient
            .from('categories')
            .select('id')
            .eq('slug', updates.slug)
            .neq('id', id)
            .maybeSingle();

        if (existingAutoSlug) {
            updates.slug = generateUniqueSlug(name);
        }
    }

    if (Object.keys(updates).length === 0) {
        // No fields to update, return current category
        return adminGetCategoryById(id);
    }

    const { data, error } = await serviceClient
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating category:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Delete
// ============================================================

/**
 * Delete a category.
 * Products in this category will have category_id set to NULL
 * due to ON DELETE SET NULL foreign key constraint.
 *
 * @param {string} id - Category UUID
 * @returns {Promise<Object>} Deletion confirmation
 * @throws {NotFoundError} If category not found
 */
async function deleteCategory(id) {
    // Verify category exists
    await adminGetCategoryById(id);

    const { error } = await serviceClient
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting category:', error);
        throw error;
    }

    return { deleted: true, id };
}

// ============================================================
// Product Count
// ============================================================

/**
 * Get the count of active products in a category.
 *
 * @param {string} categoryId - Category UUID
 * @returns {Promise<number>} Number of active products
 */
async function getProductCount(categoryId) {
    const { count, error } = await serviceClient
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .eq('active', true);

    if (error) {
        console.error('Error counting category products:', error);
        return 0;
    }

    return count || 0;
}

// ============================================================
// Export
// ============================================================
module.exports = {
    getAllCategories,
    getCategoryBySlug,
    getCategoryById,
    adminGetAllCategories,
    adminGetCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getProductCount,
};