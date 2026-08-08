// ============================================================
// CloudyBreeze E-Commerce System
// Order Service
// ============================================================
// Handles all order business logic.
//
// Responsibilities:
// - Order creation with line items
// - Order number generation (CB-YYYYNNNNNN)
// - Price calculation and validation
// - Order tracking by order number
// - Admin order management
// - Status updates
// ============================================================

const { serviceClient } = require('../config/supabase');
const { generateOrderNumber } = require('../utils/helpers');
const { ORDER_STATUS, PAYMENT_STATUS, SHIPPING } = require('../utils/constants');
const { NotFoundError, BadRequestError, ConflictError } = require('../middleware/errorHandler');

// ============================================================
// Order Number Generation
// ============================================================

/**
 * Generate the next sequential order number.
 * Uses a database count to determine the sequence.
 *
 * Format: CB-YYYYNNNNNN (e.g., CB-2026000125)
 *
 * @returns {Promise<string>} Generated order number
 */
async function getNextOrderNumber() {
    // Count existing orders for the current year to determine sequence
    const currentYear = new Date().getFullYear();
    const yearPrefix = `CB-${currentYear}`;

    const { count, error } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .like('order_number', `${yearPrefix}%`);

    if (error) {
        console.error('Error generating order number:', error);
        // Fallback: use timestamp-based sequence
        const timestamp = Date.now().toString().slice(-6);
        return `${yearPrefix}${timestamp}`;
    }

    const sequenceNumber = (count || 0) + 1;
    return generateOrderNumber(sequenceNumber);
}

// ============================================================
// Create Order
// ============================================================

/**
 * Create a new order with line items.
 *
 * Flow:
 * 1. Validate items array
 * 2. Fetch current product/variant prices from database
 * 3. Validate shipping country server-side
 * 4. Calculate subtotal, shipping, total
 * 5. Generate order number
 * 6. Insert order record
 * 7. Insert order items
 * 8. Return complete order
 *
 * @param {Object} orderData - Order data from checkout
 * @returns {Promise<Object>} Created order with items
 * @throws {BadRequestError} If validation fails
 * @throws {NotFoundError} If a product is not found
 */
async function createOrder(orderData) {
    const {
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        shipping_city,
        shipping_country,
        shipping_country_code,
        payment_method,
        notes,
        items,
    } = orderData;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('Order must contain at least one item.');
    }

    // Validate shipping country against server-side table
    const normalizedCountryCode = String(shipping_country_code || '').trim().toUpperCase();
    const normalizedCountryName = String(shipping_country || '').trim();
    let shippingCountryRecord = null;

    if (normalizedCountryCode) {
        const { data: countryByCode, error: countryCodeError } = await serviceClient
            .from('shipping_countries')
            .select('country_code, country_name, shipping_cost, estimated_days_min, estimated_days_max, active')
            .eq('country_code', normalizedCountryCode)
            .maybeSingle();

        if (countryCodeError) {
            console.error('Error validating shipping country:', countryCodeError);
            throw countryCodeError;
        }

        shippingCountryRecord = countryByCode || null;
    }

    if (!shippingCountryRecord && normalizedCountryName) {
        const { data: countryByName, error: countryNameError } = await serviceClient
            .from('shipping_countries')
            .select('country_code, country_name, shipping_cost, estimated_days_min, estimated_days_max, active')
            .eq('country_name', normalizedCountryName)
            .maybeSingle();

        if (countryNameError) {
            console.error('Error validating shipping country:', countryNameError);
            throw countryNameError;
        }

        shippingCountryRecord = countryByName || null;
    }

    if (!shippingCountryRecord) {
        throw new BadRequestError('Selected shipping country is not available.');
    }

    if (!shippingCountryRecord.active) {
        throw new BadRequestError(
            `Shipping to "${shippingCountryRecord.country_name}" is currently unavailable.`
        );
    }

    // Fetch current product prices and build order items
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
        // Get product
        const { data: product, error: productError } = await serviceClient
            .from('products')
            .select('id, name, price, active')
            .eq('id', item.product_id)
            .single();

        if (productError || !product) {
            throw new NotFoundError(`Product not found: ${item.product_id}`);
        }

        if (!product.active) {
            throw new BadRequestError(
                `Product "${product.name}" is no longer available.`
            );
        }

        let unitPrice = parseFloat(product.price);
        let variantName = null;

        // Get variant if specified
        if (item.variant_id) {
            const { data: variant, error: variantError } = await serviceClient
                .from('product_variants')
                .select('id, variation_name, price_adjustment, active')
                .eq('id', item.variant_id)
                .eq('product_id', item.product_id)
                .single();

            if (variantError || !variant) {
                throw new NotFoundError(
                    `Product variant not found: ${item.variant_id}`
                );
            }

            if (!variant.active) {
                throw new BadRequestError(
                    `Variant "${variant.variation_name}" is no longer available.`
                );
            }

            unitPrice += parseFloat(variant.price_adjustment || 0);
            variantName = variant.variation_name;
        }

        const quantity = item.quantity || 1;
        const lineTotal = parseFloat((unitPrice * quantity).toFixed(2));

        orderItems.push({
            product_id: product.id,
            variant_id: item.variant_id || null,
            product_name: product.name,
            variant_name: variantName,
            unit_price: unitPrice,
            quantity,
            line_total: lineTotal,
        });

        subtotal += lineTotal;
    }

    // Round subtotal to 2 decimal places
    subtotal = parseFloat(subtotal.toFixed(2));

    // Calculate shipping cost from the selected shipping country (server-side trusted value)
    let shippingCost = parseFloat(shippingCountryRecord.shipping_cost || SHIPPING.DEFAULT_COST);

    // Check for free shipping threshold from store settings
    const { data: settings, error: settingsError } = await serviceClient
        .from('store_settings')
        .select('free_shipping_threshold')
        .limit(1)
        .single();

    if (settingsError) {
        console.error('Error fetching store settings:', settingsError);
    }

    if (
        settings &&
        settings.free_shipping_threshold &&
        subtotal >= parseFloat(settings.free_shipping_threshold)
    ) {
        shippingCost = 0;
    }

    // Calculate total
    const total = parseFloat((subtotal + shippingCost).toFixed(2));

    // Generate order number
    const orderNumber = await getNextOrderNumber();

    // Create order record
    const { data: order, error: orderError } = await serviceClient
        .from('orders')
        .insert({
            order_number: orderNumber,
            status: ORDER_STATUS.PENDING,
            payment_status: PAYMENT_STATUS.PENDING,
            payment_method,
            subtotal,
            shipping_cost: shippingCost,
            total,
            customer_name,
            customer_email,
            customer_phone: customer_phone || null,
            shipping_address,
            shipping_city,
            shipping_country: shippingCountryRecord.country_name,
            notes: notes || null,
        })
        .select()
        .single();

    if (orderError) {
        console.error('Error creating order:', orderError);
        throw orderError;
    }

    // Insert order items
    const itemsToInsert = orderItems.map((item) => ({
        ...item,
        order_id: order.id,
    }));

    const { data: insertedItems, error: itemsError } = await serviceClient
        .from('order_items')
        .insert(itemsToInsert)
        .select();

    if (itemsError) {
        console.error('Error inserting order items:', itemsError);
        // Clean up the order if items fail to insert
        await serviceClient.from('orders').delete().eq('id', order.id);
        throw itemsError;
    }

    // Return complete order
    return {
        ...order,
        items: insertedItems,
    };
}

// ============================================================
// Track Order
// ============================================================

/**
 * Get order details by order number for customer tracking.
 * Does not expose internal UUIDs to customers.
 *
 * @param {string} orderNumber - Order number (e.g., CB-2026000125)
 * @returns {Promise<Object>} Order with items (no internal IDs exposed)
 * @throws {NotFoundError} If order not found
 */
async function trackOrder(orderNumber) {
    const { data: order, error } = await serviceClient
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

    if (error || !order) {
        throw new NotFoundError(
            `Order "${orderNumber}" not found. Please check your order number and try again.`
        );
    }

    // Get order items without exposing UUIDs
    const { data: items } = await serviceClient
        .from('order_items')
        .select('product_name, variant_name, unit_price, quantity, line_total')
        .eq('order_id', order.id)
        .order('product_name', { ascending: true });

    return {
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        total: order.total,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        shippingAddress: order.shipping_address,
        shippingCity: order.shipping_city,
        shippingCountry: order.shipping_country,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: items || [],
    };
}

// ============================================================
// Admin Queries
// ============================================================

/**
 * Get all orders for admin management.
 * Supports filtering by status and pagination.
 *
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.status] - Filter by order status
 * @param {string} [options.paymentStatus] - Filter by payment status
 * @param {string} [options.search] - Search by order number or customer email
 * @returns {Promise<Object>} Orders with pagination metadata
 */
async function adminGetAllOrders(options = {}) {
    const {
        page = 1,
        limit = 20,
        status,
        paymentStatus,
        search,
    } = options;

    const offset = (page - 1) * limit;

    let query = serviceClient
        .from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
        query = query.eq('status', status);
    }

    if (paymentStatus) {
        query = query.eq('payment_status', paymentStatus);
    }

    if (search) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(
            `order_number.ilike.${searchTerm},customer_email.ilike.${searchTerm},customer_name.ilike.${searchTerm}`
        );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching admin orders:', error);
        throw error;
    }

    return {
        orders: data || [],
        count: count || 0,
        pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
        },
    };
}

/**
 * Get a single order by ID with all items for admin.
 *
 * @param {string} id - Order UUID
 * @returns {Promise<Object>} Complete order with items
 * @throws {NotFoundError} If order not found
 */
async function adminGetOrderById(id) {
    const { data: order, error } = await serviceClient
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !order) {
        throw new NotFoundError('Order not found.');
    }

    // Get order items
    const { data: items } = await serviceClient
        .from('order_items')
        .select(
            `
            id,
            product_id,
            variant_id,
            product_name,
            variant_name,
            unit_price,
            quantity,
            line_total
        `
        )
        .eq('order_id', order.id)
        .order('product_name', { ascending: true });

    return {
        ...order,
        items: items || [],
    };
}

// ============================================================
// Status Updates
// ============================================================

/**
 * Update the status of an order.
 * Validates status transition rules.
 *
 * @param {string} id - Order UUID
 * @param {string} newStatus - New order status
 * @returns {Promise<Object>} Updated order
 * @throws {NotFoundError} If order not found
 * @throws {BadRequestError} If status transition is invalid
 */
async function updateOrderStatus(id, newStatus) {
    // Verify order exists
    const order = await adminGetOrderById(id);

    // Validate status transition
    const validTransitions = {
        [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
        [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
        [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
        [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
        [ORDER_STATUS.DELIVERED]: [],
        [ORDER_STATUS.CANCELLED]: [],
    };

    const allowedTransitions = validTransitions[order.status] || [];

    if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestError(
            `Cannot change order status from "${order.status}" to "${newStatus}". ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
        );
    }

    // Auto-update payment status for cancelled orders
    const updates = { status: newStatus };
    if (newStatus === ORDER_STATUS.CANCELLED && order.payment_status === PAYMENT_STATUS.PAID) {
        updates.payment_status = PAYMENT_STATUS.REFUNDED;
    }

    const { data, error } = await serviceClient
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating order status:', error);
        throw error;
    }

    return data;
}

/**
 * Update the payment status of an order.
 *
 * @param {string} id - Order UUID
 * @param {string} newPaymentStatus - New payment status
 * @returns {Promise<Object>} Updated order
 * @throws {NotFoundError} If order not found
 * @throws {BadRequestError} If payment status transition is invalid
 */
async function updatePaymentStatus(id, newPaymentStatus) {
    // Verify order exists
    const order = await adminGetOrderById(id);

    // Validate payment status transition
    const validTransitions = {
        [PAYMENT_STATUS.PENDING]: [
            PAYMENT_STATUS.PAID,
            PAYMENT_STATUS.FAILED,
        ],
        [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUNDED],
        [PAYMENT_STATUS.FAILED]: [PAYMENT_STATUS.PENDING],
        [PAYMENT_STATUS.REFUNDED]: [],
    };

    const allowedTransitions = validTransitions[order.payment_status] || [];

    if (!allowedTransitions.includes(newPaymentStatus)) {
        throw new BadRequestError(
            `Cannot change payment status from "${order.payment_status}" to "${newPaymentStatus}". ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
        );
    }

    // Auto-confirm order when payment is received
    const updates = { payment_status: newPaymentStatus };
    if (
        newPaymentStatus === PAYMENT_STATUS.PAID &&
        order.status === ORDER_STATUS.PENDING
    ) {
        updates.status = ORDER_STATUS.CONFIRMED;
    }

    const { data, error } = await serviceClient
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Order Statistics
// ============================================================

/**
 * Get order statistics for the admin dashboard.
 *
 * @returns {Promise<Object>} Order statistics
 */
async function getOrderStats() {
    // Total orders
    const { count: totalOrders } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true });

    // Total revenue (paid and delivered orders)
    const { data: revenueData } = await serviceClient
        .from('orders')
        .select('total')
        .in('status', [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED]);

    const totalRevenue = revenueData
        ? revenueData.reduce((sum, order) => sum + parseFloat(order.total), 0)
        : 0;

    // Orders by status
    const { data: statusData } = await serviceClient
        .from('orders')
        .select('status');

    const ordersByStatus = {};
    if (statusData) {
        statusData.forEach((order) => {
            ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
        });
    }

    // Recent orders
    const { data: recentOrders } = await serviceClient
        .from('orders')
        .select('id, order_number, customer_name, total, status, payment_status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    return {
        totalOrders: totalOrders || 0,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        ordersByStatus,
        recentOrders: recentOrders || [],
    };
}

// ============================================================
// Export
// ============================================================
module.exports = {
    createOrder,
    trackOrder,
    adminGetAllOrders,
    adminGetOrderById,
    updateOrderStatus,
    updatePaymentStatus,
    getOrderStats,
};