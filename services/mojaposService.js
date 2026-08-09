// ============================================================
// CloudyBreeze - MojaPOS Payment Service
// ============================================================
// Builds MojaPOS Hosted Checkout URLs from trusted server-side
// order data. No secret credentials are exposed to the browser.
// ============================================================

const { serviceClient } = require('../config/supabase');
const { BadRequestError, NotFoundError } = require('../middleware/errorHandler');

const MOJAPOS_CHECKOUT_URL = 'https://mojapos.com/pointofsale/checkout';

function getPublishableKey() {
    const key = process.env.MOJAPOS_PUBLISHABLE_KEY || process.env.MOJAPOS_API_KEY || '';
    if (!key || key.includes('your-mojapos') || key.includes('<')) {
        throw new BadRequestError('MojaPOS publishable key is not configured. Add a sandbox pk_test_ key to the server environment.');
    }
    return key;
}

function getEnvironment() {
    return (process.env.MOJAPOS_ENVIRONMENT || 'sandbox').toLowerCase() === 'production'
        ? 'production'
        : 'sandbox';
}

function getPublicBaseUrl(req) {
    const configured = process.env.PUBLIC_BASE_URL || process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, '');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    return `${protocol}://${req.get('host')}`;
}

function buildCheckoutUrl({ order, req }) {
    const key = getPublishableKey();
    const baseUrl = getPublicBaseUrl(req);
    const currency = (process.env.MOJAPOS_PAYMENT_CURRENCY || 'USD').toUpperCase();
    const amount = Number(order.total).toFixed(2);

    if (!Number.isFinite(Number(order.total)) || Number(order.total) <= 0) {
        throw new BadRequestError('Order total must be greater than zero before payment can be started.');
    }

    const params = new URLSearchParams({
        key,
        amount,
        currency,
        reference: order.order_number,
        description: `CloudyBreeze Order ${order.order_number}`,
        callback_url: `${baseUrl}/payment/return`,
        cancel_url: `${baseUrl}/checkout?payment=cancelled&order=${encodeURIComponent(order.order_number)}`,
    });

    return `${MOJAPOS_CHECKOUT_URL}?${params.toString()}`;
}

async function createCheckoutForOrder(orderId, req) {
    const { data: order, error } = await serviceClient
        .from('orders')
        .select('id, order_number, total, payment_status, payment_method')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        throw new NotFoundError('Order not found.');
    }

    if (order.payment_method !== 'mojapos') {
        throw new BadRequestError('This order is not configured for MojaPOS payment.');
    }

    if (order.payment_status === 'paid') {
        throw new BadRequestError('This order has already been paid.');
    }

    const checkoutUrl = buildCheckoutUrl({ order, req });
    const currency = (process.env.MOJAPOS_PAYMENT_CURRENCY || 'USD').toUpperCase();

    const { data: updatedOrder, error: updateError } = await serviceClient
        .from('orders')
        .update({
            payment_provider: 'MOJAPOS',
            payment_currency: currency,
            payment_amount: order.total,
            payment_reference: order.order_number,
            payment_environment: getEnvironment(),
            payment_checkout_url: checkoutUrl,
        })
        .eq('id', order.id)
        .select('id, order_number, total, payment_status, payment_provider, payment_currency, payment_reference, payment_environment, payment_checkout_url')
        .single();

    if (updateError) {
        console.error('Error storing MojaPOS checkout details:', updateError);
        throw updateError;
    }

    return updatedOrder;
}

module.exports = {
    buildCheckoutUrl,
    createCheckoutForOrder,
};
