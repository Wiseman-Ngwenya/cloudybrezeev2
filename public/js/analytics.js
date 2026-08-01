// ============================================================
// CloudyBreeze E-Commerce System
// Client-Side Analytics Tracker
// ============================================================
// Tracks page views and sends anonymized visitor data to the
// backend analytics endpoint.
//
// CRITICAL: This script must NEVER block page rendering or
// interfere with user interactions. All tracking is fire-and-forget.
// Failures are silently ignored.
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // Configuration
    // ============================================================
    const ANALYTICS_ENDPOINT = '/api/analytics/pageview';
    const TRACKING_ENABLED = true;

    // ============================================================
    // User Agent Parsing
    // ============================================================

    /**
     * Detect the user's browser name from the user agent string.
     *
     * @returns {string} Browser name or 'Unknown'
     */
    function detectBrowser() {
        const ua = navigator.userAgent;

        if (ua.indexOf('Firefox') > -1) return 'Firefox';
        if (ua.indexOf('Edg') > -1) return 'Edge';
        if (ua.indexOf('Chrome') > -1 && ua.indexOf('OPR') === -1) return 'Chrome';
        if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) return 'Safari';
        if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) return 'Opera';
        if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) return 'Internet Explorer';

        return 'Unknown';
    }

    /**
     * Detect the user's operating system from the user agent string.
     *
     * @returns {string} Operating system name or 'Unknown'
     */
    function detectOperatingSystem() {
        const ua = navigator.userAgent;
        const platform = navigator.platform || '';

        if (ua.indexOf('Windows') > -1 || platform.indexOf('Win') > -1) return 'Windows';
        if (ua.indexOf('Mac') > -1 || platform.indexOf('Mac') > -1) return 'macOS';
        if (ua.indexOf('Linux') > -1 || platform.indexOf('Linux') > -1) return 'Linux';
        if (ua.indexOf('Android') > -1) return 'Android';
        if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1 || ua.indexOf('iPod') > -1) return 'iOS';

        return 'Unknown';
    }

    /**
     * Detect the device type from screen width and user agent.
     *
     * @returns {string} 'desktop', 'tablet', or 'mobile'
     */
    function detectDevice() {
        const ua = navigator.userAgent;
        const width = window.innerWidth;

        // Check for mobile/tablet user agents
        const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        if (!isMobileUA) return 'desktop';
        if (width >= 768) return 'tablet';
        return 'mobile';
    }

    // ============================================================
    // Tracking Function
    // ============================================================

    /**
     * Send a page view event to the backend analytics endpoint.
     * This is fire-and-forget; errors are silently ignored.
     *
     * @param {string} [pageUrl] - The page URL to track (defaults to current pathname)
     */
    function trackPageView(pageUrl) {
        if (!TRACKING_ENABLED) return;

        try {
            const page = pageUrl || window.location.pathname;
            const referrer = document.referrer || null;

            // Build visitor data payload
            const visitorData = {
                page: page,
                referrer: referrer,
                browser: detectBrowser(),
                operating_system: detectOperatingSystem(),
                device: detectDevice(),
                // Country and city will be determined server-side from IP
            };

            // Send via sendBeacon if available (more reliable, doesn't block unload)
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(visitorData)], {
                    type: 'application/json',
                });
                navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
            } else {
                // Fallback to fetch with no-cors and keepalive
                fetch(ANALYTICS_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(visitorData),
                    keepalive: true,
                }).catch(function () {
                    // Silently ignore - analytics failures must never break the site
                });
            }
        } catch (err) {
            // Silently ignore all errors
        }
    }

    // ============================================================
    // Initialization
    // ============================================================

    /**
     * Track the initial page view when the script loads.
     */
    function init() {
        // Track the current page
        trackPageView();

        // Track single-page navigation if using History API
        // This handles cases where navigation happens via JS
        var originalPushState = history.pushState;
        var originalReplaceState = history.replaceState;

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            trackPageView();
        };

        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            trackPageView();
        };

        // Handle back/forward navigation
        window.addEventListener('popstate', function () {
            trackPageView();
        });
    }

    // ============================================================
    // Start Tracking
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();