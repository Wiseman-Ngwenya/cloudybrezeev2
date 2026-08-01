// ============================================================
// CloudyBreeze E-Commerce System
// Product Service
// ============================================================
// Handles all product business logic.
//
// Responsibilities:
// - CRUD operations for products
// - Product variants and images management
// - Search and filtering
// - Featured products
// ============================================================

const { serviceClient } = require('../config/supabase');
const { generateSlug, generateUniqueSlug, getPaginationParams } = require('../utils/helpers');
const { PAGINATION } = require('../utils/constants');
const { NotFoundError, ConflictError, BadRequestError } = require('../middleware/errorHandler');

// ============================================================
// Public Queries
// ============================================================

/**
 * Get all active products with optional filtering and pagination.
 *
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=12] - Items per page
 * @param {string} [options.category] - Filter by category slug
 * @param {string} [options.search] - Search term
 * @param {string} [options.sort='created_at'] - Sort field
 * @param {string} [options.order='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<Object>} Products with pagination metadata
 */
async function getAllProducts(options = {}) {
    const {
        page = 1,
        limit = PAGINATION.PRODUCTS_PER_PAGE,
        category,
        search,
        sort = 'created_at',
        order = 'desc',
    } = options;

    const { page: currentPage, limit: currentLimit, offset } = getPaginationParams(
        { page, limit },
        PAGINATION.PRODUCTS_PER_PAGE,
        PAGINATION.MAX_LIMIT
    );

    let query = serviceClient
        .from('products')
        .select(
            `
            *,
            category:categories(id, name, slug),
            images:product_images(image_url, is_primary, sort_order),
            variants:product_variants(id, variation_name, sku, price_adjustment, image_url, active)
        `,
            { count: 'exact' }
        )
        .eq('active', true);

    // Filter by category
    if (category) {
        const { data: categoryData } = await serviceClient
            .from('categories')
            .select('id')
            .eq('slug', category)
            .eq('active', true)
            .single();

        if (categoryData) {
            query = query.eq('category_id', categoryData.id);
        } else {
            // Category not found, return empty result
            return {
                products: [],
                count: 0,
                pagination: {
                    page: currentPage,
                    limit: currentLimit,
                    total: 0,
                    pages: 0,
                },
            };
        }
    }

    // Search by name or short description
    if (search) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(
            `name.ilike.${searchTerm},short_description.ilike.${searchTerm}`
        );
    }

    // Apply sorting
    const validSortFields = ['name', 'price', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? { ascending: true } : { ascending: false };
    query = query.order(sortField, sortOrder);

    // Apply pagination
    query = query.range(offset, offset + currentLimit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching products:', error);
        throw error;
    }

    return {
        products: data || [],
        count: count || 0,
        pagination: {
            page: currentPage,
            limit: currentLimit,
            total: count || 0,
            pages: Math.ceil((count || 0) / currentLimit),
        },
    };
}

/**
 * Get featured products for homepage display.
 *
 * @param {number} [limit=8] - Maximum number of featured products
 * @returns {Promise<Array>} Array of featured products
 */
async function getFeaturedProducts(limit = 8) {
    const { data, error } = await serviceClient
        .from('products')
        .select(
            `
            *,
            category:categories(id, name, slug),
            images:product_images(image_url, is_primary, sort_order)
        `
        )
        .eq('active', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching featured products:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single product by slug with all related data.
 *
 * @param {string} slug - Product slug
 * @returns {Promise<Object>} Product with category, images, and variants
 * @throws {NotFoundError} If product not found or inactive
 */
async function getProductBySlug(slug) {
    const { data, error } = await serviceClient
        .from('products')
        .select(
            `
            *,
            category:categories(id, name, slug),
            images:product_images(id, image_url, is_primary, sort_order),
            variants:product_variants(id, variation_name, sku, price_adjustment, image_url, active)
        `
        )
        .eq('slug', slug)
        .eq('active', true)
        .single();

    if (error || !data) {
        throw new NotFoundError(`Product "${slug}" not found.`);
    }

    // Sort images by sort_order
    if (data.images) {
        data.images.sort((a, b) => a.sort_order - b.sort_order);
    }

    // Filter only active variants
    if (data.variants) {
        data.variants = data.variants.filter((v) => v.active);
    }

    return data;
}

/**
 * Search products by query string.
 *
 * @param {string} query - Search query
 * @param {number} [limit=20] - Maximum results
 * @returns {Promise<Array>} Matching products
 */
async function searchProducts(query, limit = 20) {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const searchTerm = `%${query.trim()}%`;

    const { data, error } = await serviceClient
        .from('products')
        .select(
            `
            *,
            category:categories(id, name, slug),
            images:product_images(image_url, is_primary, sort_order)
        `
        )
        .eq('active', true)
        .or(`name.ilike.${searchTerm},short_description.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('name', { ascending: true })
        .limit(limit);

    if (error) {
        console.error('Error searching products:', error);
        throw error;
    }

    return data || [];
}

// ============================================================
// Admin Queries
// ============================================================

/**
 * Get all products for admin management.
 * Includes inactive products.
 *
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} Products with pagination metadata
 */
async function adminGetAllProducts(options = {}) {
    const {
        page = 1,
        limit = PAGINATION.ADMIN_PRODUCTS_PER_PAGE,
    } = options;

    const { page: currentPage, limit: currentLimit, offset } = getPaginationParams(
        { page, limit },
        PAGINATION.ADMIN_PRODUCTS_PER_PAGE,
        PAGINATION.MAX_LIMIT
    );

    const { data, error, count } = await serviceClient
        .from('products')
        .select(
            `
            *,
            category:categories(id, name, slug),
            images:product_images(id, image_url, is_primary, sort_order),
            variants:product_variants(id, variation_name, sku, price_adjustment, image_url, active)
        `,
            { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + currentLimit - 1);

    if (error) {
        console.error('Error fetching admin products:', error);
        throw error;
    }

    return {
        products: data || [],
        count: count || 0,
        pagination: {
            page: currentPage,
            limit: currentLimit,
            total: count || 0,
            pages: Math.ceil((count || 0) / currentLimit),
        },
    };
}

/**
 * Get a single product by ID for admin.
 * Includes inactive products.
 *
 * @param {string} id - Product UUID
 * @returns {Promise<Object>} Product with all related data
 * @throws {NotFoundError} If product not found
 */
async function adminGetProductById(id) {
    const { data, error } = await serviceClient
        .from('products')
        .select(
            `
            *,
            category:categories(id, name, slug),
            images:product_images(id, image_url, is_primary, sort_order),
            variants:product_variants(id, variation_name, sku, price_adjustment, image_url, active)
        `
        )
        .eq('id', id)
        .single();

    if (error || !data) {
        throw new NotFoundError('Product not found.');
    }

    // Sort images by sort_order
    if (data.images) {
        data.images.sort((a, b) => a.sort_order - b.sort_order);
    }

    return data;
}

// ============================================================
// Create
// ============================================================

/**
 * Create a new product.
 *
 * @param {Object} productData - Product fields
 * @returns {Promise<Object>} Created product
 * @throws {ConflictError} If slug already exists
 */
async function createProduct(productData) {
    const {
        name,
        slug,
        category_id,
        short_description,
        description,
        price,
        compare_price,
        featured,
        active,
        cover_image,
    } = productData;

    // Generate slug if not provided
    let productSlug = slug || generateSlug(name);

    // Check if slug already exists
    const { data: existingSlug } = await serviceClient
        .from('products')
        .select('id')
        .eq('slug', productSlug)
        .maybeSingle();

    if (existingSlug) {
        if (slug) {
            throw new ConflictError(
                `A product with the slug "${slug}" already exists. Please choose a different slug.`
            );
        }
        productSlug = generateUniqueSlug(name);
    }

    const { data, error } = await serviceClient
        .from('products')
        .insert({
            name,
            slug: productSlug,
            category_id: category_id || null,
            short_description: short_description || null,
            description: description || null,
            price,
            compare_price: compare_price || null,
            featured: featured !== undefined ? featured : false,
            active: active !== undefined ? active : true,
            cover_image: cover_image || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating product:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Update
// ============================================================

/**
 * Update an existing product.
 *
 * @param {string} id - Product UUID
 * @param {Object} productData - Fields to update
 * @returns {Promise<Object>} Updated product
 * @throws {NotFoundError} If product not found
 * @throws {ConflictError} If new slug conflicts
 */
async function updateProduct(id, productData) {
    // Verify product exists
    await adminGetProductById(id);

    const {
        name,
        slug,
        category_id,
        short_description,
        description,
        price,
        compare_price,
        featured,
        active,
        cover_image,
    } = productData;

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (category_id !== undefined) updates.category_id = category_id;
    if (short_description !== undefined) updates.short_description = short_description;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (compare_price !== undefined) updates.compare_price = compare_price;
    if (featured !== undefined) updates.featured = featured;
    if (active !== undefined) updates.active = active;
    if (cover_image !== undefined) updates.cover_image = cover_image;

    // Handle slug update with uniqueness check
    if (slug !== undefined) {
        const { data: existingSlug } = await serviceClient
            .from('products')
            .select('id')
            .eq('slug', slug)
            .neq('id', id)
            .maybeSingle();

        if (existingSlug) {
            throw new ConflictError(
                `A product with the slug "${slug}" already exists.`
            );
        }
        updates.slug = slug;
    } else if (name !== undefined) {
        updates.slug = generateSlug(name);

        const { data: existingAutoSlug } = await serviceClient
            .from('products')
            .select('id')
            .eq('slug', updates.slug)
            .neq('id', id)
            .maybeSingle();

        if (existingAutoSlug) {
            updates.slug = generateUniqueSlug(name);
        }
    }

    if (Object.keys(updates).length === 0) {
        return adminGetProductById(id);
    }

    const { data, error } = await serviceClient
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating product:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Delete
// ============================================================

/**
 * Delete a product and all related data.
 * product_images and product_variants are CASCADE deleted.
 *
 * @param {string} id - Product UUID
 * @returns {Promise<Object>} Deletion confirmation
 * @throws {NotFoundError} If product not found
 */
async function deleteProduct(id) {
    await adminGetProductById(id);

    const { error } = await serviceClient
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting product:', error);
        throw error;
    }

    return { deleted: true, id };
}

// ============================================================
// Toggle Active Status
// ============================================================

/**
 * Toggle the active status of a product.
 *
 * @param {string} id - Product UUID
 * @returns {Promise<Object>} Updated product with new active status
 * @throws {NotFoundError} If product not found
 */
async function toggleProductActive(id) {
    const product = await adminGetProductById(id);

    const { data, error } = await serviceClient
        .from('products')
        .update({ active: !product.active })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error toggling product active status:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Product Images Management
// ============================================================

/**
 * Add an image to a product gallery.
 *
 * @param {string} productId - Product UUID
 * @param {string} imageUrl - Image URL
 * @param {boolean} [isPrimary=false] - Set as primary image
 * @param {number} [sortOrder] - Display order
 * @returns {Promise<Object>} Created product image record
 */
async function addProductImage(productId, imageUrl, isPrimary = false, sortOrder = null) {
    await adminGetProductById(productId);

    // If setting as primary, unset any existing primary
    if (isPrimary) {
        await serviceClient
            .from('product_images')
            .update({ is_primary: false })
            .eq('product_id', productId)
            .eq('is_primary', true);
    }

    // Determine sort order
    let newSortOrder = sortOrder;
    if (newSortOrder === null) {
        const { data: existingImages } = await serviceClient
            .from('product_images')
            .select('sort_order')
            .eq('product_id', productId)
            .order('sort_order', { ascending: false })
            .limit(1);

        newSortOrder = existingImages && existingImages.length > 0
            ? existingImages[0].sort_order + 1
            : 0;
    }

    const { data, error } = await serviceClient
        .from('product_images')
        .insert({
            product_id: productId,
            image_url: imageUrl,
            is_primary: isPrimary,
            sort_order: newSortOrder,
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding product image:', error);
        throw error;
    }

    return data;
}

/**
 * Remove an image from a product gallery.
 *
 * @param {string} imageId - Product image UUID
 * @returns {Promise<Object>} Deletion confirmation
 */
async function removeProductImage(imageId) {
    const { data: existingImage } = await serviceClient
        .from('product_images')
        .select('id, product_id')
        .eq('id', imageId)
        .single();

    if (!existingImage) {
        throw new NotFoundError('Product image not found.');
    }

    const { error } = await serviceClient
        .from('product_images')
        .delete()
        .eq('id', imageId);

    if (error) {
        console.error('Error removing product image:', error);
        throw error;
    }

    return { deleted: true, id: imageId };
}

// ============================================================
// Product Variants Management
// ============================================================

/**
 * Add a variant to a product.
 *
 * @param {string} productId - Product UUID
 * @param {Object} variantData - Variant fields
 * @returns {Promise<Object>} Created variant
 */
async function addProductVariant(productId, variantData) {
    await adminGetProductById(productId);

    const { variation_name, sku, price_adjustment, image_url, active } = variantData;

    // Check SKU uniqueness if provided
    if (sku) {
        const { data: existingSku } = await serviceClient
            .from('product_variants')
            .select('id')
            .eq('sku', sku)
            .maybeSingle();

        if (existingSku) {
            throw new ConflictError(
                `A variant with the SKU "${sku}" already exists.`
            );
        }
    }

    const { data, error } = await serviceClient
        .from('product_variants')
        .insert({
            product_id: productId,
            variation_name,
            sku: sku || null,
            price_adjustment: price_adjustment !== undefined ? price_adjustment : 0,
            image_url: image_url || null,
            active: active !== undefined ? active : true,
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding product variant:', error);
        throw error;
    }

    return data;
}

/**
 * Update a product variant.
 *
 * @param {string} variantId - Variant UUID
 * @param {Object} variantData - Fields to update
 * @returns {Promise<Object>} Updated variant
 */
async function updateProductVariant(variantId, variantData) {
    const { data: existingVariant } = await serviceClient
        .from('product_variants')
        .select('id')
        .eq('id', variantId)
        .single();

    if (!existingVariant) {
        throw new NotFoundError('Product variant not found.');
    }

    const { variation_name, sku, price_adjustment, image_url, active } = variantData;

    const updates = {};
    if (variation_name !== undefined) updates.variation_name = variation_name;
    if (price_adjustment !== undefined) updates.price_adjustment = price_adjustment;
    if (image_url !== undefined) updates.image_url = image_url;
    if (active !== undefined) updates.active = active;

    // Check SKU uniqueness if being updated
    if (sku !== undefined) {
        const { data: existingSku } = await serviceClient
            .from('product_variants')
            .select('id')
            .eq('sku', sku)
            .neq('id', variantId)
            .maybeSingle();

        if (existingSku) {
            throw new ConflictError(
                `A variant with the SKU "${sku}" already exists.`
            );
        }
        updates.sku = sku;
    }

    if (Object.keys(updates).length === 0) {
        return existingVariant;
    }

    const { data, error } = await serviceClient
        .from('product_variants')
        .update(updates)
        .eq('id', variantId)
        .select()
        .single();

    if (error) {
        console.error('Error updating product variant:', error);
        throw error;
    }

    return data;
}

/**
 * Remove a variant from a product.
 *
 * @param {string} variantId - Variant UUID
 * @returns {Promise<Object>} Deletion confirmation
 */
async function removeProductVariant(variantId) {
    const { data: existingVariant } = await serviceClient
        .from('product_variants')
        .select('id')
        .eq('id', variantId)
        .single();

    if (!existingVariant) {
        throw new NotFoundError('Product variant not found.');
    }

    const { error } = await serviceClient
        .from('product_variants')
        .delete()
        .eq('id', variantId);

    if (error) {
        console.error('Error removing product variant:', error);
        throw error;
    }

    return { deleted: true, id: variantId };
}

// ============================================================
// Most Viewed Products
// ============================================================

/**
 * Get most viewed products based on analytics data.
 *
 * @param {number} [limit=10] - Maximum results
 * @returns {Promise<Array>} Products ordered by view count
 */
async function getMostViewedProducts(limit = 10) {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('page')
        .like('page', '/products/%')
        .order('visited_at', { ascending: false })
        .limit(1000);

    if (error) {
        console.error('Error fetching most viewed products:', error);
        return [];
    }

    // Count page views manually
    const pageCounts = {};
    data.forEach((visitor) => {
        const slug = visitor.page.replace('/products/', '').split('?')[0];
        if (slug) {
            pageCounts[slug] = (pageCounts[slug] || 0) + 1;
        }
    });

    // Sort by view count
    const sortedSlugs = Object.entries(pageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([slug]) => slug);

    if (sortedSlugs.length === 0) return [];

    // Fetch product details for top slugs
    const { data: products } = await serviceClient
        .from('products')
        .select(
            `
            *,
            images:product_images(image_url, is_primary, sort_order)
        `
        )
        .eq('active', true)
        .in('slug', sortedSlugs);

    if (!products) return [];

    // Sort products to match slug order
    return sortedSlugs
        .map((slug) => products.find((p) => p.slug === slug))
        .filter(Boolean);
}

// ============================================================
// Export
// ============================================================
module.exports = {
    getAllProducts,
    getFeaturedProducts,
    getProductBySlug,
    searchProducts,
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
    getMostViewedProducts,
};