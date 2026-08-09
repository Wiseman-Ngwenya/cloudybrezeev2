// ============================================================
// CloudyBreeze - Payment Routes
// ============================================================

const express = require('express');
const router = express.Router();

const { serviceClient } = require('../config/supabase');
const { createCheckoutForOrder, handleWebhookEvent } = require('../services/mojaposService');
const { BadRequestError, NotFoundError } = require('../middleware/errorHandler');

// Start a MojaPOS Hosted Checkout for an existing order.
router.post('/mojapos/checkout', async (req, res, next) => {
    try {
        const { orderId } = req.body || {};
        if (!orderId) throw new BadRequestError('orderId is required.');

        const result = await createCheckoutForOrder(orderId, req);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Receive asynchronous MojaPOS payment status events.
// This endpoint must remain publicly reachable because MojaPOS calls it directly.
router.post('/mojapos/webhook', async (req, res, next) => {
    try {
        const result = await handleWebhookEvent(req.body, req.headers);
        // MojaPOS requires a quick 200 response for accepted webhook events.
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

// Allow the frontend to retrieve the current payment state for a known order.
router.get('/orders/:orderId/status', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { data, error } = await serviceClient
            .from('orders')
            .select('id, order_number, payment_status, payment_provider, payment_currency, payment_amount, payment_reference, payment_transaction_id, paid_at')
            .eq('id', orderId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new NotFoundError('Order not found.');

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
