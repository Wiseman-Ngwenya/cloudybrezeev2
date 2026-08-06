// ============================================================
// CloudyBreeze E-Commerce System
// Admin Panel JavaScript
// ============================================================
// Shared functionality for all admin pages:
// - Authentication management
// - API helper functions
// - Logout functionality
// - Token verification and refresh
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // Configuration
    // ============================================================
    var TOKEN_KEY = 'cb_admin_token';
    var USER_KEY = 'cb_admin_user';

    // ============================================================
    // Authentication
    // ============================================================

    /**
     * Get the stored access token.
     *
     * @returns {string|null} The access token or null
     */
    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    /**
     * Get the stored user object.
     *
     * @returns {Object|null} The user object or null
     */
    function getUser() {
        try {
            var userJson = localStorage.getItem(USER_KEY);
            return userJson ? JSON.parse(userJson) : null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Check if the user is authenticated.
     * Verifies the token exists and user has admin role.
     *
     * @returns {boolean} Whether the user is authenticated
     */
    function checkAuth() {
        var token = getToken();
        var user = getUser();

        if (!token || !user) {
            return false;
        }

        if (user.role !== 'admin') {
            return false;
        }

        return true;
    }

    /**
     * Logout the current admin user.
     * Clears stored credentials and redirects to login page.
     */
    function logout() {
        var token = getToken();

        // Attempt to call logout endpoint (fire and forget)
        if (token) {
            fetch('/api/admin/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token,
                },
            }).catch(function () {
                // Silently ignore logout errors
            });
        }

        // Clear stored data
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        // Redirect to login
        window.location.href = '/admin/login.html';
    }

    // ============================================================
    // Sidebar Enhancements
    // ============================================================

    function injectAdminNavItem() {
        var navLists = document.querySelectorAll('.admin-nav-list');

        navLists.forEach(function (navList) {
            if (!navList || navList.querySelector('[data-admin-nav="messages"]')) {
                return;
            }

            var settingsLink = navList.querySelector('a[href="/admin/settings.html"]');
            var messagesItem = document.createElement('li');
            messagesItem.setAttribute('data-admin-nav', 'messages');
            messagesItem.innerHTML =
                '<a href="/admin/messages.html" class="admin-nav-link">' +
                    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
                    'Messages' +
                '</a>';

            if (settingsLink && settingsLink.parentElement) {
                navList.insertBefore(messagesItem, settingsLink.parentElement);
            } else {
                navList.appendChild(messagesItem);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectAdminNavItem);
    } else {
        injectAdminNavItem();
    }

    // ============================================================
    // API Helpers
    // ============================================================

    /**
     * Get the Authorization header with Bearer token.
     *
     * @returns {Object} Headers object
     */
    function getAuthHeaders() {
        var token = getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
        };
    }

    /**
     * Make an authenticated API request.
     * Automatically handles 401 responses by redirecting to login.
     *
     * @param {string} url - API endpoint URL
     * @param {string} [method='GET'] - HTTP method
     * @param {Object} [body=null] - Request body (for POST/PUT/PATCH)
     * @returns {Promise<Object>} Parsed JSON response
     */
    function apiRequest(url, method, body) {
        method = method || 'GET';
        var options = {
            method: method,
            headers: getAuthHeaders(),
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        return fetch(url, options)
            .then(function (res) {
                // Handle 401 - redirect to login
                if (res.status === 401) {
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(USER_KEY);
                    window.location.href = '/admin/login.html';
                    throw new Error('Unauthorized');
                }
                return res.json();
            });
    }

    /**
     * Make a GET request.
     *
     * @param {string} url - API endpoint URL
     * @returns {Promise<Object>} Parsed JSON response
     */
    function apiGet(url) {
        return apiRequest(url, 'GET');
    }

    /**
     * Make a POST request.
     *
     * @param {string} url - API endpoint URL
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Parsed JSON response
     */
    function apiPost(url, body) {
        return apiRequest(url, 'POST', body);
    }

    /**
     * Make a PUT request.
     *
     * @param {string} url - API endpoint URL
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Parsed JSON response
     */
    function apiPut(url, body) {
        return apiRequest(url, 'PUT', body);
    }

    /**
     * Make a PATCH request.
     *
     * @param {string} url - API endpoint URL
     * @param {Object} [body={}] - Request body
     * @returns {Promise<Object>} Parsed JSON response
     */
    function apiPatch(url, body) {
        return apiRequest(url, 'PATCH', body || {});
    }

    /**
     * Make a DELETE request.
     *
     * @param {string} url - API endpoint URL
     * @returns {Promise<Object>} Parsed JSON response
     */
    function apiDelete(url) {
        return apiRequest(url, 'DELETE');
    }

    // ============================================================
    // Token Refresh
    // ============================================================

    /**
     * Verify and potentially refresh the access token.
     * Called periodically to keep the session alive.
     *
     * @returns {Promise<boolean>} Whether the token is valid
     */
    function verifyToken() {
        return apiPost('/api/admin/auth/verify')
            .then(function (result) {
                return result.success && result.data && result.data.valid;
            })
            .catch(function () {
                return false;
            });
    }

    // Set up periodic token verification (every 30 minutes)
    setInterval(function () {
        if (checkAuth()) {
            verifyToken().then(function (isValid) {
                if (!isValid) {
                    logout();
                }
            });
        }
    }, 30 * 60 * 1000);

    // ============================================================
    // Public API
    // ============================================================

    window.CloudyBreezeAdmin = {
        getToken: getToken,
        getUser: getUser,
        checkAuth: checkAuth,
        logout: logout,
        apiRequest: apiRequest,
        apiGet: apiGet,
        apiPost: apiPost,
        apiPut: apiPut,
        apiPatch: apiPatch,
        apiDelete: apiDelete,
        verifyToken: verifyToken,
    };
})();