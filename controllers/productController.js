// ============================================================
// CloudyBreeze E-Commerce System
// Product Controller
// ============================================================
// Handles HTTP request/response for product operations.
//
// Responsibilities:
// - Parse request inputs and query parameters
// - Call product service layer
// - Format and send responses with pagination metadata
// - No business logic (delegated to productService)
// ============================================================

const productService = require('../services/productService');
const { successResponse, paginatedResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * GET /api/products
 *
 * Get all active products with optional filtering and pagination.
 * Query params: page, limit, category, search, sort, order
 * Returns: Paginated products array with category, images, and variants
 */
const getAllProducts = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 12,
        category: req.query.category || null,
        search: req.query.search || null,
        sort: req.query.sort || 'created_at',
        order: req.query.order || 'desc',
    };

    const result = await productService.getAllProducts(options);

    res.status(200).json(
        paginatedResponse(
            result.products,
            result.count,
            result.pagination.page,
            result.pagination.limit
        )
    );
});

/**
 * GET /api/products/featured
 *
 * Get featured products for homepage display.
 * Query params: limit (default: 8)
 * Returns: Array of featured products
 */
const getFeaturedProducts = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 8;

    const products = await productService.getFeaturedProducts(limit);

    res.status(200).json(
        successResponse(products)
    );
});

/**
 * GET /api/products/search
 *
 * Search products by query string.
 * Query params: q (search term), limit
 * Returns: Array of matching products
 */
const searchProducts = asyncHandler(async (req, res) => {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit, 10) || 20;

    const products = await productService.searchProducts(query, limit);

    res.status(200).json(
        successResponse(products)
    );
});

/**
 * GET /api/products/category/:slug
 *
 * Get products by category slug.
 * Query params: page, limit, sort, order
 * Returns: Paginated products in the specified category
 */
const getProductsByCategory = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 12,
        category: slug,
        sort: req.query.sort || 'created_at',
        order: req.query.order || 'desc',
    };

    const result = await productService.getAllProducts(options);

    res.status(200).json(
        paginatedResponse(
            result.products,
            result.count,
            result.pagination.page,
            result.pagination.limit
        )
    );
});

/**
 * GET /api/products/:slug
 *
 * Get a single product by slug with all details.
 * Returns: Product with category, images, and active variants
 */
const getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const product = await productService.getProductBySlug(slug);

    res.status(200).json(
        successResponse(product)
    );
});

/**
 * GET /api/analytics/products/top
 *
 * Get most viewed products based on analytics data.
 * Query params: limit (default: 10)
 * Returns: Array of products sorted by view count
 */
const getMostViewedProducts = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;

    const products = await productService.getMostViewedProducts(limit);

    res.status(200).json(
        successResponse(products)
    );
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/products
 *
 * Get all products for admin management.
 * Includes inactive products.
 * Query params: page, limit
 * Returns: Paginated products with category, images, and variants
 */
const adminGetAllProducts = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
    };

    const result = await productService.adminGetAllProducts(options);

    res.status(200).json(
        paginatedResponse(
            result.products,
            result.count,
            result.pagination.page,
            result.pagination.limit
        )
    );
});

/**
 * GET /api/admin/products/:id
 *
 * Get a single product by ID for admin.
 * Includes inactive products and all related data.
 * Returns: Complete product object
 */
const adminGetProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await productService.adminGetProductById(id);

    res.status(200).json(
        successResponse(product)
    );
});

/**
 * POST /api/admin/products
 *
 * Create a new product.
 * Body: { name, slug?, category_id?, short_description?, description?, price, compare_price?, featured?, active?, cover_image? }
 * Returns: Created product object
 */
const createProduct = asyncHandler(async (req, res) => {
    const product = await productService.createProduct(req.body);

    res.status(201).json(
        successResponse(product, 'Product created successfully.')
    );
});

/**
 * PUT /api/admin/products/:id
 *
 * Update an existing product.
 * Body: { name?, slug?, category_id?, short_description?, description?, price?, compare_price?, featured?, active?, cover_image? }
 * Returns: Updated product object
 */
const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await productService.updateProduct(id, req.body);

    res.status(200).json(
        successResponse(product, 'Product updated successfully.')
    );
});

/**
 * DELETE /api/admin/products/:id
 *
 * Delete a product and all related images and variants.
 * Returns: { deleted: true, id }
 */
const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await productService.deleteProduct(id);

    res.status(200).json(
        successResponse(result, 'Product deleted successfully.')
    );
});

/**
 * PATCH /api/admin/products/:id/toggle
 *
 * Toggle the active status of a product.
 * Returns: Updated product with new active status
 */
const toggleProductActive = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await productService.toggleProductActive(id);

    const status = product.active ? 'activated' : 'deactivated';

    res.status(200).json(
        successResponse(product, `Product ${status} successfully.`)
    );
});

// ============================================================
// Product Images Controllers
// ============================================================

/**
 * POST /api/admin/products/:id/images
 *
 * Add an image to a product gallery.
 * Body: { image_url, is_primary?, sort_order? }
 * Returns: Created product image record
 */
const addProductImage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { image_url, is_primary, sort_order } = req.body;

    const image = await productService.addProductImage(
        id,
        image_url,
        is_primary || false,
        sort_order
    );

    res.status(201).json(
        successResponse(image, 'Product image added successfully.')
    );
});

/**
 * DELETE /api/admin/products/:productId/images/:imageId
 *
 * Remove an image from a product gallery.
 * Returns: { deleted: true, id }
 */
const removeProductImage = asyncHandler(async (req, res) => {
    const { imageId } = req.params;

    const result = await productService.removeProductImage(imageId);

    res.status(200).json(
        successResponse(result, 'Product image removed successfully.')
    );
});

// ============================================================
// Product Variants Controllers
// ============================================================

/**
 * POST /api/admin/products/:id/variants
 *
 * Add a variant to a product.
 * Body: { variation_name, sku?, price_adjustment?, image_url?, active? }
 * Returns: Created variant object
 */
const addProductVariant = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const variant = await productService.addProductVariant(id, req.body);

    res.status(201).json(
        successResponse(variant, 'Product variant added successfully.')
    );
});

/**
 * PUT /api/admin/products/:productId/variants/:variantId
 *
 * Update a product variant.
 * Body: { variation_name?, sku?, price_adjustment?, image_url?, active? }
 * Returns: Updated variant object
 */
const updateProductVariant = asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    const variant = await productService.updateProductVariant(
        variantId,
        req.body
    );

    res.status(200).json(
        successResponse(variant, 'Product variant updated successfully.')
    );
});

/**
 * DELETE /api/admin/products/:productId/variants/:variantId
 *
 * Remove a variant from a product.
 * Returns: { deleted: true, id }
 */
const removeProductVariant = asyncHandler(async (req, res) => {
    const { variantId } = req.params;

    const result = await productService.removeProductVariant(variantId);

    res.status(200).json(
        successResponse(result, 'Product variant removed successfully.')
    );
});

// ============================================================
// Export
// ============================================================
module.exports = {
    getAllProducts,
    getFeaturedProducts,
    searchProducts,
    getProductsByCategory,
    getProductBySlug,
    getMostViewedProducts,
    adminGetAllProducts,
    adminGetProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductActive,
    addProductImage,
    removeProductImage,
    addProductVariant,
    updateProductVariant,
    removeProductVariant,
};