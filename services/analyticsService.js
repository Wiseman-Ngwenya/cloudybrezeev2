// ============================================================
// CloudyBreeze E-Commerce System
// Analytics Service
// ============================================================
// Handles all analytics business logic.
//
// Responsibilities:
// - Record page views and visitor data
// - Record product views
// - Aggregate visitor statistics
// - Geographic and device analytics
// - Product view tracking
// - Dashboard overview data
//
// CRITICAL: Analytics failures must NEVER block customer operations.
// All tracking functions should fail silently or log errors without
// interrupting the calling code.
// ============================================================

const { serviceClient } = require('../config/supabase');
const { getDateRange } = require('../utils/helpers');
const { ANALYTICS } = require('../utils/constants');

// ============================================================
// Record Page View
// ============================================================

/**
 * Record a page view in the visitors table.
 * This function is designed to be fire-and-forget.
 * Failures are logged but never thrown to the caller.
 *
 * @param {Object} visitorData - Visitor information
 * @param {string} [visitorData.ip_address] - Visitor IP address
 * @param {string} [visitorData.country] - Country from geo lookup
 * @param {string} [visitorData.city] - City from geo lookup
 * @param {string} [visitorData.browser] - Browser name
 * @param {string} [visitorData.operating_system] - OS name
 * @param {string} [visitorData.device] - Device type (desktop, mobile, tablet)
 * @param {string} [visitorData.page] - Friendly page name
 * @param {string} [visitorData.referrer] - Referrer URL or page name
 * @returns {Promise<void>} Resolves immediately, errors are caught silently
 */
async function recordPageView(visitorData) {
    try {
        const {
            ip_address,
            country,
            city,
            browser,
            operating_system,
            device,
            page,
            referrer,
        } = visitorData;

        if (!page) return;

        const { error } = await serviceClient
            .from('visitors')
            .insert({
                ip_address: ip_address || null,
                country: country || null,
                city: city || null,
                browser: browser || null,
                operating_system: operating_system || null,
                device: device || null,
                page: String(page).substring(0, 120),
                referrer: referrer ? String(referrer).substring(0, 500) : null,
            });

        if (error) {
            console.error('Analytics: Failed to record page view:', error.message);
        }
    } catch (err) {
        console.error('Analytics: Unexpected error recording page view:', err.message);
    }
}

/**
 * Record a product view in the product_views table.
 * Failures are logged but never thrown to the caller.
 *
 * @param {Object} viewData
 * @param {string} viewData.product_id
 * @param {string} [viewData.session_id]
 * @param {string} [viewData.page_path]
 * @param {string} [viewData.referrer]
 * @param {string} [viewData.country]
 * @param {string} [viewData.city]
 * @param {string} [viewData.browser]
 * @param {string} [viewData.operating_system]
 * @param {string} [viewData.device]
 * @returns {Promise<void>}
 */
async function recordProductView(viewData) {
    try {
        const {
            product_id,
            session_id,
            page_path,
            referrer,
            country,
            city,
            browser,
            operating_system,
            device,
        } = viewData;

        if (!product_id) return;

        const { error } = await serviceClient
            .from('product_views')
            .insert({
                product_id,
                session_id: session_id || null,
                page_path: page_path || null,
                referrer: referrer || null,
                country: country || null,
                city: city || null,
                browser: browser || null,
                operating_system: operating_system || null,
                device: device || null,
            });

        if (error) {
            console.error('Analytics: Failed to record product view:', error.message);
        }
    } catch (err) {
        console.error('Analytics: Unexpected error recording product view:', err.message);
    }
}

// ============================================================
// Admin Dashboard Overview
// ============================================================

/**
 * Get dashboard overview statistics.
 * Includes visitor counts, order stats, and recent activity.
 *
 * @returns {Promise<Object>} Dashboard overview data
 */
async function getOverview() {
    const today = getDateRange('today');
    const thisWeek = getDateRange('week');
    const thisMonth = getDateRange('month');

    const { count: visitorsToday } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', today.startDate)
        .lte('visited_at', today.endDate);

    const { count: visitorsThisWeek } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', thisWeek.startDate)
        .lte('visited_at', thisWeek.endDate);

    const { count: visitorsThisMonth } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', thisMonth.startDate)
        .lte('visited_at', thisMonth.endDate);

    const { count: totalVisitors } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true });

    const { count: ordersToday } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.startDate)
        .lte('created_at', today.endDate);

    const { count: ordersThisMonth } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisMonth.startDate)
        .lte('created_at', thisMonth.endDate);

    const { count: totalOrders } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true });

    const { data: revenueData } = await serviceClient
        .from('orders')
        .select('total')
        .gte('created_at', thisMonth.startDate)
        .lte('created_at', thisMonth.endDate)
        .neq('status', 'cancelled');

    const monthlyRevenue = revenueData
        ? revenueData.reduce((sum, order) => sum + parseFloat(order.total), 0)
        : 0;

    const { data: recentVisitors } = await serviceClient
        .from('visitors')
        .select('*')
        .order('visited_at', { ascending: false })
        .limit(ANALYTICS.RECENT_VISITORS_LIMIT);

    const { data: recentOrders } = await serviceClient
        .from('orders')
        .select('id, order_number, customer_name, total, status, payment_status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    return {
        visitors: {
            today: visitorsToday || 0,
            thisWeek: visitorsThisWeek || 0,
            thisMonth: visitorsThisMonth || 0,
            total: totalVisitors || 0,
        },
        orders: {
            today: ordersToday || 0,
            thisMonth: ordersThisMonth || 0,
            total: totalOrders || 0,
        },
        revenue: {
            thisMonth: parseFloat(monthlyRevenue.toFixed(2)),
        },
        recentVisitors: recentVisitors || [],
        recentOrders: recentOrders || [],
    };
}

// ============================================================
// Visitor Statistics
// ============================================================

async function getDailyVisitors(period = 'month') {
    const { startDate, endDate } = getDateRange(period);

    const { data, error } = await serviceClient
        .from('visitors')
        .select('visited_at')
        .gte('visited_at', startDate)
        .lte('visited_at', endDate)
        .order('visited_at', { ascending: true });

    if (error) {
        console.error('Error fetching daily visitors:', error);
        return [];
    }

    const dailyCounts = {};
    data.forEach((visitor) => {
        const date = visitor.visited_at.split('T')[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    return Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTopCountries(limit = ANALYTICS.TOP_COUNTRIES_LIMIT) {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('country')
        .not('country', 'is', null);

    if (error) {
        console.error('Error fetching top countries:', error);
        return [];
    }

    const countryCounts = {};
    data.forEach((visitor) => {
        if (visitor.country) {
            countryCounts[visitor.country] = (countryCounts[visitor.country] || 0) + 1;
        }
    });

    return Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

async function getDeviceStats() {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('device')
        .not('device', 'is', null);

    if (error) {
        console.error('Error fetching device stats:', error);
        return {};
    }

    const deviceCounts = {};
    data.forEach((visitor) => {
        if (visitor.device) {
            deviceCounts[visitor.device] = (deviceCounts[visitor.device] || 0) + 1;
        }
    });

    return deviceCounts;
}

async function getBrowserStats() {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('browser')
        .not('browser', 'is', null);

    if (error) {
        console.error('Error fetching browser stats:', error);
        return {};
    }

    const browserCounts = {};
    data.forEach((visitor) => {
        if (visitor.browser) {
            browserCounts[visitor.browser] = (browserCounts[visitor.browser] || 0) + 1;
        }
    });

    return Object.entries(browserCounts)
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
}

async function getOperatingSystemStats() {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('operating_system')
        .not('operating_system', 'is', null);

    if (error) {
        console.error('Error fetching OS stats:', error);
        return {};
    }

    const osCounts = {};
    data.forEach((visitor) => {
        if (visitor.operating_system) {
            osCounts[visitor.operating_system] = (osCounts[visitor.operating_system] || 0) + 1;
        }
    });

    return Object.entries(osCounts)
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
}

// ============================================================
// Page Analytics
// ============================================================

async function getTopPages(limit = ANALYTICS.TOP_PAGES_LIMIT) {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('page')
        .not('page', 'is', null);

    if (error) {
        console.error('Error fetching top pages:', error);
        return [];
    }

    const pageCounts = {};
    data.forEach((visitor) => {
        if (visitor.page) {
            const page = String(visitor.page).trim();
            pageCounts[page] = (pageCounts[page] || 0) + 1;
        }
    });

    return Object.entries(pageCounts)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

async function getTopReferrers(limit = 10) {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('referrer')
        .not('referrer', 'is', null);

    if (error) {
        console.error('Error fetching top referrers:', error);
        return [];
    }

    const referrerCounts = {};
    data.forEach((visitor) => {
        if (visitor.referrer) {
            referrerCounts[visitor.referrer] = (referrerCounts[visitor.referrer] || 0) + 1;
        }
    });

    return Object.entries(referrerCounts)
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

// ============================================================
// Product Analytics
// ============================================================

async function getProductViewStats(limit = ANALYTICS.TOP_PRODUCTS_LIMIT) {
    const { data, error } = await serviceClient
        .from('product_views')
        .select('product_id')
        .order('viewed_at', { ascending: false })
        .limit(5000);

    if (error) {
        console.error('Error fetching product view stats:', error);
        return [];
    }

    const productCounts = {};
    data.forEach((view) => {
        if (view.product_id) {
            productCounts[view.product_id] = (productCounts[view.product_id] || 0) + 1;
        }
    });

    const sortedProductIds = Object.entries(productCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([productId]) => productId);

    if (sortedProductIds.length === 0) return [];

    const { data: products } = await serviceClient
        .from('products')
        .select('id, name, slug, price, cover_image, active')
        .in('id', sortedProductIds);

    if (!products) return [];

    return sortedProductIds
        .map((productId) => {
            const product = products.find((p) => p.id === productId);
            return product
                ? {
                      id: product.id,
                      name: product.name,
                      slug: product.slug,
                      price: product.price,
                      coverImage: product.cover_image,
                      active: product.active,
                      views: productCounts[productId],
                  }
                : null;
        })
        .filter(Boolean);
}

// ============================================================
// Unique Visitors
// ============================================================

async function getUniqueVisitors(period = 'month') {
    const { startDate, endDate } = getDateRange(period);

    const { data, error } = await serviceClient
        .from('visitors')
        .select('ip_address')
        .gte('visited_at', startDate)
        .lte('visited_at', endDate)
        .not('ip_address', 'is', null);

    if (error) {
        console.error('Error fetching unique visitors:', error);
        return 0;
    }

    const uniqueIps = new Set(data.map((v) => v.ip_address));
    return uniqueIps.size;
}

// ============================================================
// Export
// ============================================================
module.exports = {
    recordPageView,
    recordProductView,
    getOverview,
    getDailyVisitors,
    getTopCountries,
    getDeviceStats,
    getBrowserStats,
    getOperatingSystemStats,
    getTopPages,
    getTopReferrers,
    getProductViewStats,
    getUniqueVisitors,
};