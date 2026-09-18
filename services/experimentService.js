// ============================================================
// CloudyBreeze Interest Test Experiment Service
// ============================================================
// Server-side reads for the private admin experiment dashboard.
// Uses the service-role client only on the server.
// ============================================================

const { serviceClient } = require('../config/supabase');

const FUNNEL_EVENT_TYPES = [
    'product_view',
    'add_to_cart',
    'checkout_started',
    'checkout_form_started',
    'checkout_form_completed',
    'payment_attempt',
    'payment_unavailable',
];

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

async function getUniqueEventSessions(eventType, since) {
    const pageSize = 1000;
    const sessionIds = new Set();
    let from = 0;

    while (true) {
        let query = serviceClient
            .from('experiment_events')
            .select('session_id')
            .eq('event_type', eventType)
            .not('session_id', 'is', null)
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1);

        if (since) query = query.gte('created_at', since);

        const { data, error } = await query;
        if (error) throw error;

        const rows = data || [];
        rows.forEach((row) => {
            if (row.session_id) sessionIds.add(row.session_id);
        });

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    return sessionIds;
}

function percent(value, total) {
    if (!total) return 0;
    return Number(((value / total) * 100).toFixed(1));
}

async function getFunnelAnalytics(since) {
    const stageDefinitions = [
        { key: 'visitors', label: 'Visitors', source: 'sessions' },
        { key: 'productViews', label: 'Product Views', eventType: 'product_view' },
        { key: 'addToCart', label: 'Add to Cart', eventType: 'add_to_cart' },
        { key: 'checkoutStarted', label: 'Checkout Started', eventType: 'checkout_started' },
        { key: 'checkoutFormStarted', label: 'Form Started', eventType: 'checkout_form_started' },
        { key: 'checkoutFormCompleted', label: 'Form Completed', eventType: 'checkout_form_completed' },
        { key: 'paymentAttempts', label: 'Payment Attempts', eventType: 'payment_attempt' },
        { key: 'paymentUnavailable', label: 'Payment Unavailable', eventType: 'payment_unavailable' },
    ];

    const [visitorCount, ...eventSessionSets] = await Promise.all([
        countSessions(since),
        ...stageDefinitions.slice(1).map((stage) => getUniqueEventSessions(stage.eventType, since)),
    ]);

    const counts = { visitors: visitorCount };
    stageDefinitions.slice(1).forEach((stage, index) => {
        counts[stage.key] = eventSessionSets[index].size;
    });

    const stages = stageDefinitions.map((stage, index) => {
        const count = counts[stage.key];
        const previous = index > 0 ? counts[stageDefinitions[index - 1].key] : null;
        const conversionFromPrevious = previous === null ? null : percent(count, previous);
        const dropoffFromPrevious = previous === null ? null : Math.max(previous - count, 0);

        return {
            key: stage.key,
            label: stage.label,
            count,
            conversion_from_previous: conversionFromPrevious,
            dropoff_from_previous: dropoffFromPrevious,
            conversion_from_visitors: percent(count, visitorCount),
        };
    });

    return {
        period_start: since,
        stages,
    };
}

function sourceFromSession(session) {
    const utmSource = String(session.utm_source || '').trim();
    if (utmSource) return utmSource;

    const referrer = String(session.referrer || '').trim();
    if (!referrer) return 'Direct';

    try {
        const url = new URL(referrer);
        const hostname = url.hostname.replace(/^www\./i, '');
        return hostname || 'Referral';
    } catch (_) {
        return referrer.slice(0, 100);
    }
}

function sourceKey(source) {
    return String(source || 'Direct').trim().toLowerCase();
}

function displaySource(source) {
    const normalized = String(source || 'Direct').trim();
    if (normalized.toLowerCase() === 'direct') return 'Direct';
    return normalized;
}

async function getTrafficSourceAnalytics(since) {
    const pageSize = 1000;
    const sessions = [];
    let from = 0;

    while (true) {
        const { data, error } = await serviceClient
            .from('experiment_sessions')
            .select('session_id, utm_source, utm_medium, referrer, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = data || [];
        sessions.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    if (!sessions.length) return [];

    const sessionById = new Map();
    const groups = new Map();

    sessions.forEach((session) => {
        sessionById.set(session.session_id, session);

        const source = sourceFromSession(session);
        const key = sourceKey(source);

        if (!groups.has(key)) {
            groups.set(key, {
                source: displaySource(source),
                medium: session.utm_medium || null,
                visitors: 0,
                productViews: new Set(),
                addToCart: new Set(),
                checkoutStarted: new Set(),
                checkoutFormStarted: new Set(),
                checkoutFormCompleted: new Set(),
                paymentAttempts: new Set(),
                paymentUnavailable: new Set(),
            });
        }

        groups.get(key).visitors += 1;
    });

    let eventFrom = 0;
    while (true) {
        const { data, error } = await serviceClient
            .from('experiment_events')
            .select('session_id, event_type, created_at')
            .gte('created_at', since)
            .in('event_type', FUNNEL_EVENT_TYPES)
            .not('session_id', 'is', null)
            .order('created_at', { ascending: true })
            .range(eventFrom, eventFrom + pageSize - 1);

        if (error) throw error;

        const rows = data || [];
        rows.forEach((event) => {
            const session = sessionById.get(event.session_id);
            if (!session) return;

            const group = groups.get(sourceKey(sourceFromSession(session)));
            if (!group || !group[event.event_type === 'product_view' ? 'productViews'
                : event.event_type === 'add_to_cart' ? 'addToCart'
                : event.event_type === 'checkout_started' ? 'checkoutStarted'
                : event.event_type === 'checkout_form_started' ? 'checkoutFormStarted'
                : event.event_type === 'checkout_form_completed' ? 'checkoutFormCompleted'
                : event.event_type === 'payment_attempt' ? 'paymentAttempts'
                : 'paymentUnavailable']) return;

            const field = event.event_type === 'product_view' ? 'productViews'
                : event.event_type === 'add_to_cart' ? 'addToCart'
                : event.event_type === 'checkout_started' ? 'checkoutStarted'
                : event.event_type === 'checkout_form_started' ? 'checkoutFormStarted'
                : event.event_type === 'checkout_form_completed' ? 'checkoutFormCompleted'
                : event.event_type === 'payment_attempt' ? 'paymentAttempts'
                : 'paymentUnavailable';

            group[field].add(event.session_id);
        });

        if (rows.length < pageSize) break;
        eventFrom += pageSize;
    }

    return Array.from(groups.values())
        .sort((a, b) => b.visitors - a.visitors)
        .map((group) => ({
            source: group.source,
            medium: group.medium,
            visitors: group.visitors,
            product_views: group.productViews.size,
            add_to_cart: group.addToCart.size,
            checkout_started: group.checkoutStarted.size,
            form_started: group.checkoutFormStarted.size,
            form_completed: group.checkoutFormCompleted.size,
            payment_attempts: group.paymentAttempts.size,
            payment_unavailable: group.paymentUnavailable.size,
            intent_rate: percent(group.checkoutFormCompleted.size, group.visitors),
        }));
}

async function getCountryAnalytics(since) {
    const pageSize = 1000;
    const leads = [];
    let from = 0;

    while (true) {
        const { data, error } = await serviceClient
            .from('experiment_leads')
            .select('id, session_id, country_name, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = data || [];
        leads.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    if (!leads.length) return [];

    const sessionIds = Array.from(new Set(leads.map((lead) => lead.session_id).filter(Boolean)));
    const eventsBySession = new Map();

    let eventFrom = 0;
    while (sessionIds.length && true) {
        const chunk = sessionIds.slice(eventFrom * 500, eventFrom * 500 + 500);
        if (!chunk.length) break;

        const { data, error } = await serviceClient
            .from('experiment_events')
            .select('session_id, event_type')
            .in('session_id', chunk)
            .gte('created_at', since)
            .in('event_type', ['checkout_form_completed', 'payment_attempt', 'payment_unavailable']);

        if (error) throw error;

        (data || []).forEach((event) => {
            const set = eventsBySession.get(event.session_id) || new Set();
            set.add(event.event_type);
            eventsBySession.set(event.session_id, set);
        });

        eventFrom += 1;
    }

    const groups = new Map();

    leads.forEach((lead) => {
        const country = String(lead.country_name || 'Unknown').trim() || 'Unknown';
        const key = country.toLowerCase();

        if (!groups.has(key)) {
            groups.set(key, {
                country,
                leads: new Set(),
                formCompleted: new Set(),
                paymentAttempts: new Set(),
                paymentUnavailable: new Set(),
            });
        }

        const group = groups.get(key);
        const identity = lead.session_id || lead.id;
        group.leads.add(identity);

        const eventTypes = eventsBySession.get(lead.session_id) || new Set();
        if (eventTypes.has('checkout_form_completed')) group.formCompleted.add(identity);
        if (eventTypes.has('payment_attempt')) group.paymentAttempts.add(identity);
        if (eventTypes.has('payment_unavailable')) group.paymentUnavailable.add(identity);
    });

    return Array.from(groups.values())
        .sort((a, b) => b.leads.size - a.leads.size)
        .map((group) => ({
            country: group.country,
            details_submitted: group.formCompleted.size || group.leads.size,
            payment_attempts: group.paymentAttempts.size,
            payment_unavailable: group.paymentUnavailable.size,
        }));
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
        funnelAnalytics,
        trafficSources,
        countries,
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
        getFunnelAnalytics(sevenDaysAgo),
        getTrafficSourceAnalytics(sevenDaysAgo),
        getCountryAnalytics(sevenDaysAgo),
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
        funnelAnalytics,
        trafficSources,
        countries,
        recentLeads,
    };
}

module.exports = {
    getOverview,
    getRecentLeads,
    getRecentSessions,
    getSessionDetail,
};
