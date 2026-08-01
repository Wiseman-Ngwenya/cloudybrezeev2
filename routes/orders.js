// ============================================================
// CloudyBreeze E-Commerce System
// Order Routes
// ============================================================
// Defines routes for order operations.
// Public routes mounted at /api/orders
// Admin routes mounted at /api/admin/orders
// ============================================================

const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const {
    orderValidationRules,
    orderStatusValidationRules,
    paymentStatusValidationRules,
    uuidParam,
    handleValidationResult,
} = require('../middleware/validate');

// ============================================================
// Public Routes
// ============================================================

// POST /api/orders
// Create a new order (guest checkout)
router.post(
    '/',
    orderValidationRules,
    handleValidationResult,
    orderController.createOrder
);

// GET /api/orders/track/:order_number
// Track an order by order number
router.get('/track/:order_number', orderController.trackOrder);

// ============================================================
// Admin Routes
// ============================================================

// All admin routes require authentication
router.use('/admin', authenticate);

// GET /api/admin/orders
// Get all orders with filtering and pagination
router.get('/admin', orderController.adminGetAllOrders);

// GET /api/admin/orders/stats
// Get order statistics for dashboard
router.get('/admin/stats', orderController.getOrderStats);

// GET /api/admin/orders/:id
// Get a single order by ID with all items
router.get(
    '/admin/:id',
    uuidParam('id'),
    handleValidationResult,
    orderController.adminGetOrderById
);

// PUT /api/admin/orders/:id/status
// Update order status
router.put(
    '/admin/:id/status',
    uuidParam('id'),
    orderStatusValidationRules,
    handleValidationResult,
    orderController.updateOrderStatus
);

// PUT /api/admin/orders/:id/payment
// Update payment status
router.put(
    '/admin/:id/payment',
    uuidParam('id'),
    paymentStatusValidationRules,
    handleValidationResult,
    orderController.updatePaymentStatus
);

// ============================================================
// Export
// ============================================================
module.exports = router;