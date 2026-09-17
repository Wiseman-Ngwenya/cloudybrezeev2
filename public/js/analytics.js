// ============================================================
// CloudyBreeze E-Commerce System
// Client-Side Analytics Tracker
// ============================================================
// Tracks existing backend analytics and, on the interest-test
// branch, loads the independent serverless experiment tracker.
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

    function detectDevice() {
        const ua = navigator.userAgent;
        const width = window.innerWidth;
        const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        if (!isMobileUA) return 'desktop';
        if (width >= 768) return 'tablet';
        return 'mobile';
    }

    // ============================================================
    // Existing backend analytics
    // ============================================================

    function trackPageView(pageUrl) {
        if (!TRACKING_ENABLED) return;

        try {
            const page = pageUrl || window.location.pathname;
            const referrer = document.referrer || null;

            const visitorData = {
                page: page,
                referrer: referrer,
                browser: detectBrowser(),
                operating_system: detectOperatingSystem(),
                device: detectDevice(),
            };

            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(visitorData)], {
                    type: 'application/json',
                });
                navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
            } else {
                fetch(ANALYTICS_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(visitorData),
                    keepalive: true,
                }).catch(function () {});
            }
        } catch (err) {
            // Analytics failures must never break the site.
        }
    }

    // ============================================================
    // Interest-test tracker loader
    // ============================================================

    function loadInterestTestTracker() {
        try {
            if (window.CloudyBreezeExperiment) return;
            if (document.querySelector('script[data-cloudybreeze-experiment="true"]')) return;

            var script = document.createElement('script');
            script.src = '/js/experiment-tracker.js';
            script.async = true;
            script.dataset.cloudybreezeExperiment = 'true';
            script.onerror = function () {
                // Experiment tracking is optional and must never break the store.
            };
            document.head.appendChild(script);
        } catch (err) {
            // Silently ignore tracker loading failures.
        }
    }

    // ============================================================
    // Initialization
    // ============================================================

    function init() {
        trackPageView();
        loadInterestTestTracker();

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

        window.addEventListener('popstate', function () {
            trackPageView();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();