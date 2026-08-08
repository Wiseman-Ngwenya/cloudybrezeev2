// ============================================================
// CloudyBreeze E-Commerce System
// Admin Panel JavaScript
// ============================================================
// Shared functionality for all admin pages:
// - Authentication management
// - API helper functions
// - Logout functionality
// - Token verification and refresh
// - Shared sidebar link injection
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

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        try {
            var userJson = localStorage.getItem(USER_KEY);
            return userJson ? JSON.parse(userJson) : null;
        } catch (err) {
            return null;
        }
    }

    function checkAuth() {
        var token = getToken();
        var user = getUser();

        if (!token || !user) return false;
        return user.role === 'admin';
    }

    function logout() {
        var token = getToken();

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

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = '/admin/login.html';
    }

    // ============================================================
    // Sidebar Enhancements
    // ============================================================

    function createNavItem(href, label, svg, isActive) {
        var li = document.createElement('li');
        li.innerHTML =
            '<a href="' + href + '" class="admin-nav-link' + (isActive ? ' active' : '') + '">' +
                svg +
                '<span>' + label + '</span>' +
            '</a>';
        return li;
    }

    function injectSidebarLink(navList, options) {
        if (!navList || navList.querySelector('a[href="' + options.href + '"]')) {
            return;
        }

        var settingsLink = navList.querySelector('a[href="/admin/settings.html"]');
        var beforeSelector = options.beforeSelector || 'a[href="/admin/settings.html"]';
        var beforeLink = navList.querySelector(beforeSelector);
        var isActive = window.location.pathname === options.href;
        var item = createNavItem(options.href, options.label, options.svg, isActive);
        item.setAttribute('data-admin-nav', options.key);

        if (beforeLink && beforeLink.parentElement) {
            navList.insertBefore(item, beforeLink.parentElement);
            return;
        }

        if (settingsLink && settingsLink.parentElement) {
            navList.insertBefore(item, settingsLink.parentElement);
            return;
        }

        navList.appendChild(item);
    }

    function injectAdminNavItems() {
        var navLists = document.querySelectorAll('.admin-nav-list');

        navLists.forEach(function (navList) {
            injectSidebarLink(navList, {
                key: 'shipping-countries',
                href: '/admin/shipping-countries.html',
                label: 'Shipping Countries',
                svg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16v-8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
                beforeSelector: 'a[href="/admin/messages.html"]',
            });

            injectSidebarLink(navList, {
                key: 'messages',
                href: '/admin/messages.html',
                label: 'Messages',
                svg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
                beforeSelector: 'a[href="/admin/settings.html"]',
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectAdminNavItems);
    } else {
        injectAdminNavItems();
    }

    // ============================================================
    // API Helpers
    // ============================================================

    function getAuthHeaders() {
        var token = getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
        };
    }

    function apiRequest(url, method, body) {
        method = method || 'GET';

        var options = {
            method: method,
            headers: getAuthHeaders(),
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        return fetch(url, options).then(function (res) {
            if (res.status === 401) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                window.location.href = '/admin/login.html';
                throw new Error('Unauthorized');
            }
            return res.json();
        });
    }

    function apiGet(url) {
        return apiRequest(url, 'GET');
    }

    function apiPost(url, body) {
        return apiRequest(url, 'POST', body);
    }

    function apiPut(url, body) {
        return apiRequest(url, 'PUT', body);
    }

    function apiPatch(url, body) {
        return apiRequest(url, 'PATCH', body || {});
    }

    function apiDelete(url) {
        return apiRequest(url, 'DELETE');
    }

    // ============================================================
    // Token Refresh
    // ============================================================

    function verifyToken() {
        return apiPost('/api/admin/auth/verify')
            .then(function (result) {
                return result.success && result.data && result.data.valid;
            })
            .catch(function () {
                return false;
            });
    }

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