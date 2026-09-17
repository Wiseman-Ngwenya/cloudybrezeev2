// ============================================================
// CloudyBreeze Interest Test Experiment Service
// ============================================================
// Server-side reads for the private admin experiment dashboard.
// Uses the service-role client only on the server.
// ============================================================

const { serviceClient } = require('../config/supabase');

function startOfDayIso() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
}

function startOfDaysAgoIso(days) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - days);
    return start.toISOString();
}

async function countEvents(eventType, since) {
    let query = serviceClient
        .from('experiment_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', eventType);

    if (since) query = query.gte('created_at', since);

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

async function countSessions(since) {
    let query = serviceClient
        .from('experiment_sessions')
        .select('session_id', { count: 'exact', head: true });

    if (since) query = query.gte('created_at', since);

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

async function countLeads(since) {
    let query = serviceClient
        .from('experiment_leads')
        .select('id', { count: 'exact', head: true });

    if (since) query = query.gte('created_at', since);

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

async function getRecentLeads(limit = 10) {
    const { data, error } = await serviceClient
        .from('experiment_leads')
        .select('id, full_name, email, phone, country_name, city, checkout_total, currency, product_summary, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

async function getOverview() {
    const today = startOfDayIso();
    const sevenDaysAgo = startOfDaysAgoIso(6);

    const [
        visitorsTotal,
        visitorsToday,
        productViews,
        productViewsToday,
        addToCart,
        checkoutStarted,
        checkoutFormStarted,
        checkoutFormCompleted,
        paymentAttempts,
        paymentUnavailable,
        leadsTotal,
        leadsToday,
        recentLeads,
    ] = await Promise.all([
        countSessions(),
        countSessions(today),
        countEvents('product_view'),
        countEvents('product_view', today),
        countEvents('add_to_cart', sevenDaysAgo),
        countEvents('checkout_started', sevenDaysAgo),
        countEvents('checkout_form_started', sevenDaysAgo),
        countEvents('checkout_form_completed', sevenDaysAgo),
        countEvents('payment_attempt', sevenDaysAgo),
        countEvents('payment_unavailable', sevenDaysAgo),
        countLeads(),
        countLeads(today),
        getRecentLeads(),
    ]);

    return {
        period: {
            funnel: 'last_7_days',
            today: 'today',
        },
        sessions: {
            total: visitorsTotal,
            today: visitorsToday,
        },
        productViews: {
            total: productViews,
            today: productViewsToday,
        },
        funnel: {
            addToCart,
            checkoutStarted,
            checkoutFormStarted,
            checkoutFormCompleted,
            paymentAttempts,
            paymentUnavailable,
            leads: leadsTotal,
            leadsToday,
        },
        recentLeads,
    };
}

module.exports = {
    getOverview,
    getRecentLeads,
};
