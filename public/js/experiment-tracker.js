// ============================================================
// CloudyBreeze Interest Test Tracker
// Serverless browser-side experiment tracking via Supabase.
// ============================================================
// This module intentionally uses only a Supabase publishable key.
// It never contains or requests a service/secret key.
//
// Public API:
//   window.CloudyBreezeExperiment.track(type, data)
//   window.CloudyBreezeExperiment.getSessionId()
// ============================================================

(function () {
    'use strict';

    var SUPABASE_URL = 'https://xtcumrmayetcihqmtqkx.supabase.co';
    var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vHvVfT1349nefV3o1a7--g_HVSPuFDT';
    var SESSION_STORAGE_KEY = 'cb_test_session_id';
    var ATTRIBUTION_STORAGE_KEY = 'cb_test_attribution';
    var TRACKER_VERSION = '1.0.0';
    var MAX_TEXT_LENGTH = 1000;
    var MAX_METADATA_KEYS = 30;
    var DEDUPE_WINDOW_MS = 1200;

    var supabaseClient = null;
    var sessionId = null;
    var sessionReadyPromise = null;
    var recentEvents = Object.create(null);

    var ALLOWED_EVENT_TYPES = {
        page_view: true,
        product_view: true,
        product_image_view: true,
        add_to_cart: true,
        remove_from_cart: true,
        cart_view: true,
        buy_now_click: true,
        checkout_started: true,
        checkout_form_started: true,
        checkout_form_completed: true,
        payment_attempt: true,
        payment_unavailable: true,
        newsletter_signup: true,
        contact_submit: true
    };

    // ------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------

    function safeLocalStorageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (err) {
            return null;
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (err) {
            return false;
        }
    }

    function generateSessionId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            var bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;

            var hex = Array.prototype.map.call(bytes, function (byte) {
                return byte.toString(16).padStart(2, '0');
            }).join('');

            return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
        }

        return 'cb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    }

    function getOrCreateSessionId() {
        var existing = safeLocalStorageGet(SESSION_STORAGE_KEY);

        if (existing && typeof existing === 'string' && existing.length >= 16 && existing.length <= 128) {
            return existing;
        }

        var created = generateSessionId();
        safeLocalStorageSet(SESSION_STORAGE_KEY, created);
        return created;
    }

    function cleanText(value, maxLength) {
        if (value === null || value === undefined) return null;
        var text = String(value).trim();
        if (!text) return null;
        return text.slice(0, maxLength || MAX_TEXT_LENGTH);
    }

    function cleanNumber(value, min, max) {
        var number = Number(value);
        if (!Number.isFinite(number)) return null;
        if (number < min || number > max) return null;
        return number;
    }

    function sanitizeMetadata(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

        var output = {};
        var keys = Object.keys(input).slice(0, MAX_METADATA_KEYS);

        keys.forEach(function (key) {
            if (!/^[a-zA-Z0-9_\-]{1,80}$/.test(key)) return;

            var value = input[key];

            if (value === null || typeof value === 'boolean' || typeof value === 'number') {
                if (typeof value !== 'number' || Number.isFinite(value)) {
                    output[key] = value;
                }
                return;
            }

            if (typeof value === 'string') {
                output[key] = cleanText(value, 500);
                return;
            }

            if (Array.isArray(value)) {
                output[key] = value.slice(0, 20).map(function (item) {
                    if (item === null || typeof item === 'boolean') return item;
                    if (typeof item === 'number') return Number.isFinite(item) ? item : null;
                    return cleanText(item, 200);
                });
            }
        });

        return output;
    }

    function readAttribution() {
        var existing = safeLocalStorageGet(ATTRIBUTION_STORAGE_KEY);

        if (existing) {
            try {
                return JSON.parse(existing) || {};
            } catch (err) {
                // Ignore malformed local storage values.
            }
        }

        var params = new URLSearchParams(window.location.search);
        var attribution = {
            landing_page: window.location.pathname || '/',
            referrer: document.referrer ? cleanText(document.referrer, 2000) : null,
            utm_source: cleanText(params.get('utm_source'), 200),
            utm_medium: cleanText(params.get('utm_medium'), 200),
            utm_campaign: cleanText(params.get('utm_campaign'), 200),
            utm_content: cleanText(params.get('utm_content'), 200),
            utm_term: cleanText(params.get('utm_term'), 200)
        };

        safeLocalStorageSet(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
        return attribution;
    }

    function detectBrowser() {
        var ua = navigator.userAgent || '';

        if (/Edg\//.test(ua)) return 'Edge';
        if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
        if (/Firefox\//.test(ua)) return 'Firefox';
        if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
        if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
        if (/MSIE|Trident\//.test(ua)) return 'Internet Explorer';
        return 'Unknown';
    }

    function detectOperatingSystem() {
        var ua = navigator.userAgent || '';
        var platform = navigator.platform || '';

        if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'Windows';
        if (/Android/i.test(ua)) return 'Android';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
        if (/Mac/i.test(ua) || /Mac/i.test(platform)) return 'macOS';
        if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux';
        return 'Unknown';
    }

    function detectDeviceType() {
        var ua = navigator.userAgent || '';
        var width = window.innerWidth || 0;
        var mobileLike = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        if (!mobileLike) return 'desktop';
        if (width >= 768) return 'tablet';
        return 'mobile';
    }

    function getPagePath() {
        var path = window.location.pathname || '/';
        return cleanText(path, 1000) || '/';
    }

    // ------------------------------------------------------------
    // Supabase loading / initialization
    // ------------------------------------------------------------

    function loadSupabaseLibrary() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            return Promise.resolve(window.supabase);
        }

        return new Promise(function (resolve, reject) {
            var existingScript = document.querySelector('script[data-cloudybreeze-supabase="true"]');

            function finish() {
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                    resolve(window.supabase);
                } else {
                    reject(new Error('Supabase client failed to load'));
                }
            }

            if (existingScript) {
                existingScript.addEventListener('load', finish, { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }

            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.async = true;
            script.dataset.cloudybreezeSupabase = 'true';
            script.onload = finish;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function ensureClient() {
        return loadSupabaseLibrary().then(function (supabaseNamespace) {
            if (!supabaseClient) {
                supabaseClient = supabaseNamespace.createClient(
                    SUPABASE_URL,
                    SUPABASE_PUBLISHABLE_KEY,
                    {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                            detectSessionInUrl: false
                        }
                    }
                );
            }

            return supabaseClient;
        });
    }

    // ------------------------------------------------------------
    // Session / event writes
    // ------------------------------------------------------------

    function getSessionPayload() {
        var attribution = readAttribution();

        return {
            session_id: sessionId,
            landing_page: attribution.landing_page,
            referrer: attribution.referrer,
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_content: attribution.utm_content,
            utm_term: attribution.utm_term,
            device_type: detectDeviceType(),
            browser: detectBrowser(),
            os: detectOperatingSystem(),
            user_agent: cleanText(navigator.userAgent, 1000),
            screen_width: cleanNumber(window.screen && window.screen.width, 1, 10000),
            screen_height: cleanNumber(window.screen && window.screen.height, 1, 10000),
            timezone: cleanText(Intl.DateTimeFormat().resolvedOptions().timeZone, 200),
            language: cleanText(navigator.language, 50)
        };
    }

    function ensureSessionRow() {
        if (sessionReadyPromise) return sessionReadyPromise;

        sessionReadyPromise = ensureClient().then(function (client) {
            return client
                .from('experiment_sessions')
                .insert(getSessionPayload())
                .then(function (result) {
                    // A duplicate session_id is expected when the visitor returns
                    // to an already initialized session. Treat it as success.
                    if (result.error && result.error.code !== '23505') {
                        throw result.error;
                    }
                    return true;
                });
        }).catch(function () {
            // Do not let tracking break the storefront. Allow a later attempt.
            sessionReadyPromise = null;
            return false;
        });

        return sessionReadyPromise;
    }

    function makeEventKey(eventType, data) {
        var productPart = data && data.product_id ? String(data.product_id) : '';
        var pathPart = data && data.page_path ? String(data.page_path) : getPagePath();
        return eventType + '|' + productPart + '|' + pathPart;
    }

    function isDuplicateEvent(key) {
        var now = Date.now();
        var previous = recentEvents[key];

        recentEvents[key] = now;

        if (!previous) return false;
        return (now - previous) < DEDUPE_WINDOW_MS;
    }

    function normalizeEventData(data) {
        data = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

        return {
            product_id: cleanText(data.product_id, 80),
            page_path: cleanText(data.page_path || getPagePath(), 1000),
            metadata: sanitizeMetadata(data.metadata || {})
        };
    }

    function track(eventType, data) {
        if (!ALLOWED_EVENT_TYPES[eventType]) return Promise.resolve(false);

        var normalized = normalizeEventData(data);
        var dedupeKey = makeEventKey(eventType, normalized);

        if (isDuplicateEvent(dedupeKey)) {
            return Promise.resolve(false);
        }

        return ensureSessionRow().then(function (sessionAvailable) {
            if (!sessionAvailable) return false;

            return ensureClient().then(function (client) {
                return client
                    .from('experiment_events')
                    .insert({
                        session_id: sessionId,
                        event_type: eventType,
                        product_id: normalized.product_id || null,
                        page_path: normalized.page_path,
                        metadata: Object.assign({}, normalized.metadata, {
                            tracker_version: TRACKER_VERSION
                        })
                    })
                    .then(function (result) {
                        if (result.error) throw result.error;
                        return true;
                    })
                    .catch(function () {
                        return false;
                    });
            });
        });
    }

    function initialize() {
        sessionId = getOrCreateSessionId();
        readAttribution();

        // Create the session row first, then record the initial page view.
        ensureSessionRow().then(function () {
            track('page_view');
        });
    }

    // ------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------

    window.CloudyBreezeExperiment = {
        track: track,
        getSessionId: function () {
            return sessionId || getOrCreateSessionId();
        },
        getAttribution: readAttribution,
        version: TRACKER_VERSION
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();