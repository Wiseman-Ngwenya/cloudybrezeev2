// ============================================================
// CloudyBreeze E-Commerce System
// Order Controller
// ============================================================

const orderService = require('../services/orderService');
const mojaposService = require('../services/mojaposService');
const { successResponse, paginatedResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/orders - Create a new guest order.
const createOrder = asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.body);
    res.status(201).json(successResponse(order, 'Order placed successfully.'));
});

// POST /api/orders/:id/payment - Create the MojaPOS hosted checkout for an order.
const createPayment = asyncHandler(async (req, res) => {
    const payment = await mojaposService.createCheckoutForOrder(req.params.id, req);
    res.status(200).json(successResponse(payment, 'Payment checkout created successfully.'));
});

// GET /api/orders/track/:order_number - Track an order by order number.
const trackOrder = asyncHandler(async (req, res) => {
    const order = await orderService.trackOrder(req.params.order_number);
    res.status(200).json(successResponse(order));
});

const adminGetAllOrders = asyncHandler(async (req, res) => {
    const options = {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        status: req.query.status || null,
        paymentStatus: req.query.paymentStatus || null,
        search: req.query.search || null,
    };
    const result = await orderService.adminGetAllOrders(options);
    res.status(200).json(paginatedResponse(result.orders, result.count, result.pagination.page, result.pagination.limit));
});

const adminGetOrderById = asyncHandler(async (req, res) => {
    const order = await orderService.adminGetOrderById(req.params.id);
    res.status(200).json(successResponse(order));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
    res.status(200).json(successResponse(order, 'Order status updated successfully.'));
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
    const order = await orderService.updatePaymentStatus(req.params.id, req.body.payment_status);
    res.status(200).json(successResponse(order, 'Payment status updated successfully.'));
});

const getOrderStats = asyncHandler(async (req, res) => {
    const stats = await orderService.getOrderStats();
    res.status(200).json(successResponse(stats));
});

module.exports = {
    createOrder,
    createPayment,
    trackOrder,
    adminGetAllOrders,
    adminGetOrderById,
    updateOrderStatus,
    updatePaymentStatus,
    getOrderStats,
};
