// ============================================================
// CloudyBreeze E-Commerce System
// Order Controller
// ============================================================
// Handles HTTP request/response for order operations.
//
// Responsibilities:
// - Parse request inputs
// - Call order service layer
// - Format and send responses
// - No business logic (delegated to orderService)
// ============================================================

const orderService = require('../services/orderService');
const { successResponse, paginatedResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Public Controllers
// ============================================================

/**
 * POST /api/orders
 *
 * Create a new order (guest checkout).
 * Body: { customer_name, customer_email, customer_phone?, shipping_address,
 *         shipping_city, shipping_country, payment_method, notes?,
 *         items: [{ product_id, variant_id?, quantity }] }
 * Returns: Created order with order number and items
 */
const createOrder = asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.body);

    res.status(201).json(
        successResponse(order, 'Order placed successfully.')
    );
});

/**
 * GET /api/orders/track/:order_number
 *
 * Track an order by order number.
 * No authentication required.
 * Returns: Order details with items (no internal UUIDs exposed)
 */
const trackOrder = asyncHandler(async (req, res) => {
    const { order_number } = req.params;

    const order = await orderService.trackOrder(order_number);

    res.status(200).json(
        successResponse(order)
    );
});

// ============================================================
// Admin Controllers
// ============================================================

/**
 * GET /api/admin/orders
 *
 * Get all orders for admin management.
 * Query params: page, limit, status, paymentStatus, search
 * Returns: Paginated orders
 */
const adminGetAllOrders = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        status: req.query.status || null,
        paymentStatus: req.query.paymentStatus || null,
        search: req.query.search || null,
    };

    const result = await orderService.adminGetAllOrders(options);

    res.status(200).json(
        paginatedResponse(
            result.orders,
            result.count,
            result.pagination.page,
            result.pagination.limit
        )
    );
});

/**
 * GET /api/admin/orders/:id
 *
 * Get a single order by ID with all items.
 * Returns: Complete order object
 */
const adminGetOrderById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await orderService.adminGetOrderById(id);

    res.status(200).json(
        successResponse(order)
    );
});

/**
 * PUT /api/admin/orders/:id/status
 *
 * Update the status of an order.
 * Body: { status }
 * Returns: Updated order
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = await orderService.updateOrderStatus(id, status);

    res.status(200).json(
        successResponse(order, 'Order status updated successfully.')
    );
});

/**
 * PUT /api/admin/orders/:id/payment
 *
 * Update the payment status of an order.
 * Body: { payment_status }
 * Returns: Updated order
 */
const updatePaymentStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;

    const order = await orderService.updatePaymentStatus(id, payment_status);

    res.status(200).json(
        successResponse(order, 'Payment status updated successfully.')
    );
});

// ============================================================
// Order Statistics
// ============================================================

/**
 * GET /api/admin/orders/stats
 *
 * Get order statistics for the admin dashboard.
 * Returns: { totalOrders, totalRevenue, ordersByStatus, recentOrders }
 */
const getOrderStats = asyncHandler(async (req, res) => {
    const stats = await orderService.getOrderStats();

    res.status(200).json(
        successResponse(stats)
    );
});

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