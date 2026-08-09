// ============================================================
// CloudyBreeze E-Commerce System
// Order Routes
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

// Public order creation.
router.post('/', orderValidationRules, handleValidationResult, orderController.createOrder);

// Create a MojaPOS Hosted Checkout for an existing order.
router.post('/payment/:id', uuidParam('id'), handleValidationResult, orderController.createPayment);

// Track an order by order number.
router.get('/track/:order_number', orderController.trackOrder);

// Admin routes.
router.use('/admin', authenticate);
router.get('/admin', orderController.adminGetAllOrders);
router.get('/admin/stats', orderController.getOrderStats);
router.get('/admin/:id', uuidParam('id'), handleValidationResult, orderController.adminGetOrderById);
router.put('/admin/:id/status', uuidParam('id'), orderStatusValidationRules, handleValidationResult, orderController.updateOrderStatus);
router.put('/admin/:id/payment', uuidParam('id'), paymentStatusValidationRules, handleValidationResult, orderController.updatePaymentStatus);

module.exports = router;
