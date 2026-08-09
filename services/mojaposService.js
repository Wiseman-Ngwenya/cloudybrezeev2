// ============================================================
// CloudyBreeze - MojaPOS Payment Service
// ============================================================
// Builds MojaPOS Hosted Checkout URLs from trusted server-side
// order data and processes MojaPOS webhook callbacks.
// No secret credentials are exposed to the browser.
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

function getWebhookSecret() {
    const secret = (process.env.MOJAPOS_WEBHOOK_SECRET || '').trim();
    if (!secret || secret.includes('your-mojapos') || secret.includes('<')) return '';
    return secret;
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

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizePaymentStatus(rawEvent, rawStatus) {
    const event = normalizeText(rawEvent).toLowerCase();
    const status = normalizeText(rawStatus).toLowerCase();

    if (event === 'payment.success' || ['success', 'completed', 'paid', 'succeeded'].includes(status)) {
        return 'paid';
    }

    if (event === 'payment.failed' || ['failed', 'reversed', 'cancelled', 'canceled', 'declined'].includes(status)) {
        return 'failed';
    }

    if (event === 'payment.pending' || status === 'pending') {
        return 'pending';
    }

    return null;
}

function extractWebhookReference(payload) {
    return normalizeText(
        payload?.data?.reference ||
        payload?.data?.externalId ||
        payload?.data?.providerReference ||
        payload?.reference ||
        payload?.metadata?.reference ||
        payload?.metadata?.externalId
    );
}

function extractTransactionId(payload) {
    return normalizeText(payload?.data?.transactionId || payload?.transactionId || payload?.data?.id);
}

function extractAmount(payload, fallback) {
    const amount = Number(
        payload?.data?.amount ??
        payload?.amount ??
        fallback ??
        0
    );
    return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function extractFee(payload, keys) {
    for (const key of keys) {
        const value = payload?.data?.[key] ?? payload?.[key];
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return Number(parsed.toFixed(2));
        }
    }
    return null;
}

function isWebhookAuthenticated(headers, payload) {
    const secret = getWebhookSecret();
    if (!secret) return true;

    const headerValues = [
        headers?.['x-mojapos-webhook-secret'],
        headers?.['x-webhook-secret'],
        headers?.['x-mojapos-signature'],
        headers?.['x-mojapos-token'],
        payload?.webhook_secret,
        payload?.secret,
        payload?.signature,
    ]
        .filter(Boolean)
        .map((value) => normalizeText(value));

    return headerValues.includes(secret);
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
        callback_url: `${baseUrl}/tracking?payment=success&order=${encodeURIComponent(order.order_number)}`,
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

async function handleWebhookEvent(payload, headers = {}) {
    if (!payload || typeof payload !== 'object') {
        throw new BadRequestError('Invalid webhook payload.');
    }

    if (!isWebhookAuthenticated(headers, payload)) {
        throw new BadRequestError('Invalid MojaPOS webhook signature.');
    }

    const reference = extractWebhookReference(payload);
    const transactionId = extractTransactionId(payload);
    const paymentStatus = normalizePaymentStatus(payload.event, payload?.data?.status);

    if (!reference && !transactionId) {
        throw new BadRequestError('Webhook is missing reference information.');
    }

    let order = null;
    let orderQuery = null;

    if (transactionId) {
        const transactionLookup = await serviceClient
            .from('orders')
            .select('id, order_number, payment_status, payment_reference, payment_transaction_id')
            .eq('payment_transaction_id', transactionId)
            .maybeSingle();

        if (transactionLookup.error) {
            console.error('Error looking up order by transaction ID:', transactionLookup.error);
            throw transactionLookup.error;
        }

        order = transactionLookup.data || null;
    }

    if (!order && reference) {
        orderQuery = serviceClient
            .from('orders')
            .select('id, order_number, payment_status, payment_reference, payment_transaction_id, total')
            .or(`payment_reference.eq.${reference},order_number.eq.${reference}`)
            .maybeSingle();

        const referenceLookup = await orderQuery;
        if (referenceLookup.error) {
            console.error('Error looking up order by reference:', referenceLookup.error);
            throw referenceLookup.error;
        }

        order = referenceLookup.data || null;
    }

    if (!order) {
        console.warn('MojaPOS webhook received for unknown order:', { reference, transactionId, payload });
        return {
            received: true,
            matched: false,
            status: paymentStatus || 'unknown',
        };
    }

    const amount = extractAmount(payload, order.total);
    const providerFee = extractFee(payload, ['providerFee', 'fee']);
    const gatewayFee = extractFee(payload, ['gatewayFee']);
    const netAmount = extractFee(payload, ['netAmount', 'netAmountReceivable']);
    const currency = normalizeText(payload?.data?.currency || payload?.currency || process.env.MOJAPOS_PAYMENT_CURRENCY || 'USD').toUpperCase();

    const updates = {
        payment_provider: 'MOJAPOS',
        payment_currency: currency,
        payment_amount: amount,
        payment_reference: reference || order.payment_reference || order.order_number,
        payment_transaction_id: transactionId || order.payment_transaction_id || null,
        payment_environment: normalizeText(payload?.environment || payload?.data?.environment || getEnvironment()).toUpperCase(),
        payment_provider_fee: providerFee,
        payment_gateway_fee: gatewayFee,
        payment_net_amount: netAmount,
        payment_payload: payload,
    };

    if (paymentStatus === 'paid') {
        updates.payment_status = 'paid';
        updates.paid_at = new Date().toISOString();
    } else if (paymentStatus === 'failed') {
        updates.payment_status = 'failed';
    } else if (paymentStatus === 'pending') {
        updates.payment_status = 'pending';
    }

    const { data: updatedOrder, error: updateError } = await serviceClient
        .from('orders')
        .update(updates)
        .eq('id', order.id)
        .select('id, order_number, payment_status, payment_reference, payment_transaction_id, payment_provider, payment_currency, payment_amount, paid_at')
        .single();

    if (updateError) {
        console.error('Error updating order from MojaPOS webhook:', updateError);
        throw updateError;
    }

    return {
        received: true,
        matched: true,
        status: paymentStatus || 'unknown',
        order: updatedOrder,
    };
}

module.exports = {
    buildCheckoutUrl,
    createCheckoutForOrder,
    handleWebhookEvent,
};