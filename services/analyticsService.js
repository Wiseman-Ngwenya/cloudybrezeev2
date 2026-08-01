// ============================================================
// CloudyBreeze E-Commerce System
// Analytics Service
// ============================================================
// Handles all analytics business logic.
//
// Responsibilities:
// - Record page views and visitor data
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
 * @param {string} [visitorData.page] - Page URL visited
 * @param {string} [visitorData.referrer] - Referrer URL
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

        // Skip recording if no page is provided
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
                page: page.substring(0, 500), // Limit page URL length
                referrer: referrer ? referrer.substring(0, 500) : null,
            });

        if (error) {
            // Log but don't throw - analytics failures are non-critical
            console.error('Analytics: Failed to record page view:', error.message);
        }
    } catch (err) {
        // Catch all errors to prevent analytics from breaking the app
        console.error('Analytics: Unexpected error recording page view:', err.message);
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

    // Today's visitors
    const { count: visitorsToday } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', today.startDate)
        .lte('visited_at', today.endDate);

    // This week's visitors
    const { count: visitorsThisWeek } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', thisWeek.startDate)
        .lte('visited_at', thisWeek.endDate);

    // This month's visitors
    const { count: visitorsThisMonth } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', thisMonth.startDate)
        .lte('visited_at', thisMonth.endDate);

    // Total visitors
    const { count: totalVisitors } = await serviceClient
        .from('visitors')
        .select('*', { count: 'exact', head: true });

    // Today's orders
    const { count: ordersToday } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.startDate)
        .lte('created_at', today.endDate);

    // This month's orders
    const { count: ordersThisMonth } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisMonth.startDate)
        .lte('created_at', thisMonth.endDate);

    // Total orders
    const { count: totalOrders } = await serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true });

    // This month's revenue
    const { data: revenueData } = await serviceClient
        .from('orders')
        .select('total')
        .gte('created_at', thisMonth.startDate)
        .lte('created_at', thisMonth.endDate)
        .neq('status', 'cancelled');

    const monthlyRevenue = revenueData
        ? revenueData.reduce((sum, order) => sum + parseFloat(order.total), 0)
        : 0;

    // Recent visitors
    const { data: recentVisitors } = await serviceClient
        .from('visitors')
        .select('*')
        .order('visited_at', { ascending: false })
        .limit(ANALYTICS.RECENT_VISITORS_LIMIT);

    // Recent orders
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

/**
 * Get daily visitor counts for a given period.
 *
 * @param {string} [period='month'] - 'week', 'month', or 'year'
 * @returns {Promise<Array>} Daily visitor counts
 */
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

    // Group by date
    const dailyCounts = {};
    data.forEach((visitor) => {
        const date = visitor.visited_at.split('T')[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // Convert to array format
    return Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get top countries by visitor count.
 *
 * @param {number} [limit=10] - Maximum results
 * @returns {Promise<Array>} Countries with visitor counts
 */
async function getTopCountries(limit = ANALYTICS.TOP_COUNTRIES_LIMIT) {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('country')
        .not('country', 'is', null);

    if (error) {
        console.error('Error fetching top countries:', error);
        return [];
    }

    // Count by country
    const countryCounts = {};
    data.forEach((visitor) => {
        if (visitor.country) {
            countryCounts[visitor.country] = (countryCounts[visitor.country] || 0) + 1;
        }
    });

    // Sort and limit
    return Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Get device type distribution.
 *
 * @returns {Promise<Object>} Device type counts (desktop, mobile, tablet)
 */
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

/**
 * Get browser distribution.
 *
 * @returns {Promise<Object>} Browser usage counts
 */
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

    // Sort by count descending
    return Object.entries(browserCounts)
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
}

/**
 * Get operating system distribution.
 *
 * @returns {Promise<Object>} OS usage counts
 */
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

/**
 * Get top viewed pages.
 *
 * @param {number} [limit=10] - Maximum results
 * @returns {Promise<Array>} Pages with view counts
 */
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
            // Normalize page URL (remove query strings)
            const normalizedPage = visitor.page.split('?')[0];
            pageCounts[normalizedPage] = (pageCounts[normalizedPage] || 0) + 1;
        }
    });

    return Object.entries(pageCounts)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Get top referrers.
 *
 * @param {number} [limit=10] - Maximum results
 * @returns {Promise<Array>} Referrers with visitor counts
 */
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

/**
 * Get product page view statistics.
 *
 * @param {number} [limit=10] - Maximum results
 * @returns {Promise<Array>} Products with view counts
 */
async function getProductViewStats(limit = ANALYTICS.TOP_PRODUCTS_LIMIT) {
    const { data, error } = await serviceClient
        .from('visitors')
        .select('page')
        .like('page', '/product%')
        .order('visited_at', { ascending: false })
        .limit(5000);

    if (error) {
        console.error('Error fetching product view stats:', error);
        return [];
    }

    // Extract product slugs from URLs
    const productCounts = {};
    data.forEach((visitor) => {
        const match = visitor.page.match(/\/product(?:s)?\/([^/?]+)/);
        if (match && match[1]) {
            const slug = match[1];
            productCounts[slug] = (productCounts[slug] || 0) + 1;
        }
    });

    // Sort by view count
    const sortedSlugs = Object.entries(productCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([slug]) => slug);

    if (sortedSlugs.length === 0) return [];

    // Fetch product details
    const { data: products } = await serviceClient
        .from('products')
        .select('id, name, slug, price, cover_image, active')
        .in('slug', sortedSlugs);

    if (!products) return [];

    // Map view counts to products
    return sortedSlugs
        .map((slug) => {
            const product = products.find((p) => p.slug === slug);
            return product
                ? {
                      id: product.id,
                      name: product.name,
                      slug: product.slug,
                      price: product.price,
                      coverImage: product.cover_image,
                      active: product.active,
                      views: productCounts[slug],
                  }
                : null;
        })
        .filter(Boolean);
}

// ============================================================
// Unique Visitors
// ============================================================

/**
 * Get unique visitor count by IP address for a period.
 *
 * @param {string} [period='month'] - 'today', 'week', 'month', or 'year'
 * @returns {Promise<number>} Unique visitor count
 */
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

    // Count unique IP addresses
    const uniqueIps = new Set(data.map((v) => v.ip_address));
    return uniqueIps.size;
}

// ============================================================
// Export
// ============================================================
module.exports = {
    recordPageView,
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