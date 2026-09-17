// ============================================================
// CloudyBreeze Interest Test Tracker
// Browser-side experiment tracking via Supabase.
// ============================================================
// Public API:
//   window.CloudyBreezeExperiment.track(type, data)
//   window.CloudyBreezeExperiment.saveLead(data)
//   window.CloudyBreezeExperiment.getSessionId()
//   window.CloudyBreezeExperiment.getAttribution()
// ============================================================

(function () {
    'use strict';

    var SUPABASE_URL = 'https://xtcumrmayetcihqmtqkx.supabase.co';
    var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vHvVfT1349nefV3o1a7--g_HVSPuFDT';
    var SESSION_STORAGE_KEY = 'cb_test_session_id';
    var ATTRIBUTION_STORAGE_KEY = 'cb_test_attribution';
    var TRACKER_VERSION = '1.2.0';
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

    function text(value, maxLength) {
        if (value === null || value === undefined) return null;
        var valueText = String(value).trim();
        if (!valueText) return null;
        return valueText.slice(0, maxLength || 1000);
    }

    function number(value, min, max) {
        var result = Number(value);
        if (!Number.isFinite(result) || result < min || result > max) return null;
        return result;
    }

    function localGet(key) {
        try { return window.localStorage.getItem(key); } catch (err) { return null; }
    }

    function localSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (err) {}
    }

    function createSessionId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            var bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            var hex = Array.prototype.map.call(bytes, function (b) {
                return b.toString(16).padStart(2, '0');
            }).join('');
            return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
        }
        return 'cb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    }

    function getOrCreateSessionId() {
        var existing = localGet(SESSION_STORAGE_KEY);
        if (existing && existing.length >= 16 && existing.length <= 128) return existing;
        var created = createSessionId();
        localSet(SESSION_STORAGE_KEY, created);
        return created;
    }

    function getAttribution() {
        var stored = localGet(ATTRIBUTION_STORAGE_KEY);
        if (stored) {
            try { return JSON.parse(stored) || {}; } catch (err) {}
        }

        var params = new URLSearchParams(window.location.search);
        var attribution = {
            landing_page: window.location.pathname || '/',
            referrer: text(document.referrer, 2000),
            utm_source: text(params.get('utm_source'), 200),
            utm_medium: text(params.get('utm_medium'), 200),
            utm_campaign: text(params.get('utm_campaign'), 200),
            utm_content: text(params.get('utm_content'), 200),
            utm_term: text(params.get('utm_term'), 200)
        };
        localSet(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
        return attribution;
    }

    function browserName() {
        var ua = navigator.userAgent || '';
        if (/Edg\//.test(ua)) return 'Edge';
        if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
        if (/Firefox\//.test(ua)) return 'Firefox';
        if (/Chrome\//.test(ua)) return 'Chrome';
        if (/Safari\//.test(ua)) return 'Safari';
        return 'Unknown';
    }

    function osName() {
        var ua = navigator.userAgent || '';
        var platform = navigator.platform || '';
        if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'Windows';
        if (/Android/i.test(ua)) return 'Android';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
        if (/Mac/i.test(ua) || /Mac/i.test(platform)) return 'macOS';
        if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux';
        return 'Unknown';
    }

    function deviceType() {
        var ua = navigator.userAgent || '';
        var mobileLike = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        if (!mobileLike) return 'desktop';
        return (window.innerWidth || 0) >= 768 ? 'tablet' : 'mobile';
    }

    function pagePath() {
        return text(window.location.pathname || '/', 1000) || '/';
    }

    function loadSupabase() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            return Promise.resolve(window.supabase);
        }

        return new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-cloudybreeze-supabase="true"]');
            function finish() {
                if (window.supabase && typeof window.supabase.createClient === 'function') resolve(window.supabase);
                else reject(new Error('Supabase client failed to load'));
            }
            if (existing) {
                existing.addEventListener('load', finish, { once: true });
                existing.addEventListener('error', reject, { once: true });
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

    function getClient() {
        return loadSupabase().then(function (supabaseNamespace) {
            if (!supabaseClient) {
                supabaseClient = supabaseNamespace.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });
            }
            return supabaseClient;
        });
    }

    function sessionPayload() {
        var attribution = getAttribution();
        return {
            session_id: sessionId,
            landing_page: attribution.landing_page || '/',
            referrer: attribution.referrer,
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_content: attribution.utm_content,
            utm_term: attribution.utm_term,
            device_type: deviceType(),
            browser: browserName(),
            os: osName(),
            user_agent: text(navigator.userAgent, 1000),
            screen_width: number(window.screen && window.screen.width, 1, 10000),
            screen_height: number(window.screen && window.screen.height, 1, 10000),
            timezone: text(Intl.DateTimeFormat().resolvedOptions().timeZone, 200),
            language: text(navigator.language, 50)
        };
    }

    function ensureSession() {
        if (sessionReadyPromise) return sessionReadyPromise;
        sessionReadyPromise = getClient().then(function (client) {
            return client.from('experiment_sessions').insert(sessionPayload()).then(function (result) {
                if (result.error && result.error.code !== '23505') throw result.error;
                return true;
            });
        }).catch(function () {
            sessionReadyPromise = null;
            return false;
        });
        return sessionReadyPromise;
    }

    function sanitizeMetadata(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
        var output = {};
        Object.keys(input).slice(0, 30).forEach(function (key) {
            if (!/^[a-zA-Z0-9_\-]{1,80}$/.test(key)) return;
            var value = input[key];
            if (value === null || typeof value === 'boolean') {
                output[key] = value;
            } else if (typeof value === 'number' && Number.isFinite(value)) {
                output[key] = value;
            } else if (typeof value === 'string') {
                output[key] = text(value, 500);
            } else if (Array.isArray(value)) {
                output[key] = value.slice(0, 20).map(function (item) {
                    if (item === null || typeof item === 'boolean') return item;
                    if (typeof item === 'number') return Number.isFinite(item) ? item : null;
                    return text(item, 200);
                });
            }
        });
        return output;
    }

    function track(eventType, data) {
        if (!ALLOWED_EVENT_TYPES[eventType]) return Promise.resolve(false);
        data = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        var productId = text(data.product_id, 80);
        var path = text(data.page_path || pagePath(), 1000) || '/';
        var key = eventType + '|' + (productId || '') + '|' + path;
        var now = Date.now();
        if (recentEvents[key] && now - recentEvents[key] < DEDUPE_WINDOW_MS) return Promise.resolve(false);
        recentEvents[key] = now;

        return ensureSession().then(function (sessionAvailable) {
            if (!sessionAvailable) return false;
            return getClient().then(function (client) {
                return client.from('experiment_events').insert({
                    session_id: sessionId,
                    event_type: eventType,
                    product_id: productId || null,
                    page_path: path,
                    metadata: Object.assign({}, sanitizeMetadata(data.metadata || {}), {
                        tracker_version: TRACKER_VERSION
                    })
                }).then(function (result) {
                    return !result.error;
                }).catch(function () {
                    return false;
                });
            });
        });
    }

    function sanitizeProducts(items) {
        if (!Array.isArray(items)) return [];
        return items.slice(0, 20).map(function (item) {
            item = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
            var quantity = number(item.quantity, 1, 99);
            var unitPrice = number(item.unit_price, 0, 10000000);
            var lineTotal = number(item.line_total, 0, 10000000);
            return {
                product_id: text(item.product_id, 80),
                product_name: text(item.product_name, 200),
                variant_id: text(item.variant_id, 120),
                variant_name: text(item.variant_name, 200),
                quantity: quantity === null ? 1 : Math.round(quantity),
                unit_price: unitPrice === null ? 0 : Number(unitPrice.toFixed(2)),
                line_total: lineTotal === null ? 0 : Number(lineTotal.toFixed(2))
            };
        });
    }

    function saveLead(input) {
        input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        var name = text(input.full_name, 120) || '';
        var email = text(input.email, 320) || '';
        if (name.length < 2 || email.length < 3) {
            return Promise.resolve({ success: false, error: new Error('Lead details are incomplete') });
        }

        var payload = {
            session_id: sessionId,
            full_name: name,
            email: email,
            phone: text(input.phone, 60),
            country_code: text(input.country_code, 20),
            country_name: text(input.country_name, 120),
            city: text(input.city, 120),
            address: text(input.address, 300),
            postal_code: text(input.postal_code, 40),
            product_summary: sanitizeProducts(input.product_summary),
            checkout_subtotal: number(input.checkout_subtotal, 0, 100000000),
            checkout_shipping: number(input.checkout_shipping, 0, 100000000),
            checkout_total: number(input.checkout_total, 0, 100000000),
            currency: text(input.currency, 10)
        };

        return ensureSession().then(function (sessionAvailable) {
            if (!sessionAvailable) return { success: false, error: new Error('Experiment session unavailable') };
            return getClient().then(function (client) {
                // INSERT ONLY: never request the inserted row back.
                return client.from('experiment_leads').insert(payload).then(function (result) {
                    if (result.error) return { success: false, error: result.error };
                    return { success: true };
                });
            });
        }).catch(function (error) {
            return { success: false, error: error };
        });
    }

    sessionId = getOrCreateSessionId();
    getAttribution();

    window.CloudyBreezeExperiment = {
        track: track,
        saveLead: saveLead,
        getSessionId: function () { return sessionId; },
        getAttribution: getAttribution,
        version: TRACKER_VERSION
    };

    function initialize() {
        ensureSession().then(function () {
            track('page_view');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
