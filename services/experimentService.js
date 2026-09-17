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

function normalizeLimit(value, fallback = 50, max = 100) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function normalizeOffset(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function getJourneyStage(eventTypes) {
    const types = new Set(eventTypes);
    if (types.has('payment_unavailable')) return 'Payment unavailable';
    if (types.has('checkout_form_completed')) return 'Checkout details submitted';
    if (types.has('payment_attempt')) return 'Payment attempted';
    if (types.has('checkout_form_started')) return 'Checkout form started';
    if (types.has('checkout_started')) return 'Checkout started';
    if (types.has('add_to_cart')) return 'Added to cart';
    if (types.has('product_view')) return 'Viewed product';
    return 'Visited store';
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
        .limit(normalizeLimit(limit, 10, 50));

    if (error) throw error;
    return data || [];
}

async function getRecentSessions({ limit = 50, offset = 0 } = {}) {
    const safeLimit = normalizeLimit(limit, 50, 100);
    const safeOffset = normalizeOffset(offset);

    const { data: sessions, count, error: sessionsError } = await serviceClient
        .from('experiment_sessions')
        .select('*', { count: 'exact' })
        .order('first_seen_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) {
        return { sessions: [], total: count || 0, limit: safeLimit, offset: safeOffset };
    }

    const sessionIds = sessions.map((session) => session.session_id);

    const [{ data: events, error: eventsError }, { data: leads, error: leadsError }] = await Promise.all([
        serviceClient
            .from('experiment_events')
            .select('session_id, event_type, product_id, page_path, metadata, created_at')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true }),
        serviceClient
            .from('experiment_leads')
            .select('id, session_id')
            .in('session_id', sessionIds),
    ]);

    if (eventsError) throw eventsError;
    if (leadsError) throw leadsError;

    const eventsBySession = new Map();
    (events || []).forEach((event) => {
        const list = eventsBySession.get(event.session_id) || [];
        list.push(event);
        eventsBySession.set(event.session_id, list);
    });

    const leadsBySession = new Set((leads || []).map((lead) => lead.session_id));

    return {
        sessions: sessions.map((session) => {
            const sessionEvents = eventsBySession.get(session.session_id) || [];
            return {
                ...session,
                event_count: sessionEvents.length,
                first_event_at: sessionEvents[0]?.created_at || session.first_seen_at,
                last_event_at: sessionEvents[sessionEvents.length - 1]?.created_at || session.first_seen_at,
                journey_stage: getJourneyStage(sessionEvents.map((event) => event.event_type)),
                lead_submitted: leadsBySession.has(session.session_id),
            };
        }),
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset,
    };
}

async function getSessionDetail(sessionId) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId || normalizedSessionId.length > 128) {
        const error = new Error('Invalid session ID');
        error.statusCode = 400;
        throw error;
    }

    const [{ data: session, error: sessionError }, { data: events, error: eventsError }, { data: leads, error: leadsError }] = await Promise.all([
        serviceClient
            .from('experiment_sessions')
            .select('*')
            .eq('session_id', normalizedSessionId)
            .maybeSingle(),
        serviceClient
            .from('experiment_events')
            .select('id, session_id, event_type, product_id, page_path, metadata, created_at')
            .eq('session_id', normalizedSessionId)
            .order('created_at', { ascending: true }),
        serviceClient
            .from('experiment_leads')
            .select('id, session_id, full_name, email, phone, country_code, country_name, city, address, postal_code, product_summary, checkout_subtotal, checkout_shipping, checkout_total, currency, created_at')
            .eq('session_id', normalizedSessionId)
            .order('created_at', { ascending: true }),
    ]);

    if (sessionError) throw sessionError;
    if (eventsError) throw eventsError;
    if (leadsError) throw leadsError;

    if (!session) {
        const error = new Error('Session not found');
        error.statusCode = 404;
        throw error;
    }

    return {
        session,
        events: events || [],
        leads: leads || [],
        journey_stage: getJourneyStage((events || []).map((event) => event.event_type)),
    };
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
    getRecentSessions,
    getSessionDetail,
};
