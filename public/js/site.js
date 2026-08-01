// ============================================================
// CloudyBreeze E-Commerce System
// Common Site JavaScript
// ============================================================
// Shared functionality used across all public pages:
// - Mobile navigation toggle
// - Cart count management
// - Store settings loading (footer)
// - Current year display
// - Scroll-triggered animations
// - Header scroll shadow
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // DOM Elements
    // ============================================================
    const navToggle = document.getElementById('navToggle');
    const navList = document.getElementById('navList');
    const siteHeader = document.getElementById('siteHeader');
    const cartCount = document.getElementById('cartCount');
    const currentYear = document.getElementById('currentYear');

    // ============================================================
    // Mobile Navigation
    // ============================================================

    function initMobileNav() {
        if (!navToggle || !navList) return;

        navToggle.addEventListener('click', function () {
            const isOpen = navList.classList.toggle('open');
            navToggle.classList.toggle('active', isOpen);
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close nav when clicking outside
        document.addEventListener('click', function (e) {
            if (!navToggle || !navList) return;
            if (!navToggle.contains(e.target) && !navList.contains(e.target)) {
                navList.classList.remove('open');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close nav when a link is clicked
        navList.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                navList.classList.remove('open');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ============================================================
    // Cart Count
    // ============================================================

    /**
     * Update the cart count badge in the header.
     * Reads from localStorage and displays total quantity of items.
     */
    function updateCartCount() {
        if (!cartCount) return;

        try {
            const cart = JSON.parse(localStorage.getItem('cloudyBreezeCart') || '[]');
            const totalItems = cart.reduce(function (sum, item) {
                return sum + (item.quantity || 1);
            }, 0);

            cartCount.textContent = totalItems;

            if (totalItems > 0) {
                cartCount.style.display = 'flex';
            } else {
                cartCount.style.display = 'none';
            }
        } catch (err) {
            cartCount.textContent = '0';
            cartCount.style.display = 'none';
        }
    }

    /**
     * Animate the cart count when an item is added.
     */
    function animateCartCount() {
        if (!cartCount) return;

        cartCount.classList.remove('updating');
        // Force reflow to restart animation
        void cartCount.offsetWidth;
        cartCount.classList.add('updating');

        setTimeout(function () {
            cartCount.classList.remove('updating');
        }, 500);
    }

    // ============================================================
    // Cart Management Helpers
    // ============================================================

    /**
     * Get the current cart from localStorage.
     *
     * @returns {Array} Array of cart items
     */
    function getCart() {
        try {
            return JSON.parse(localStorage.getItem('cloudyBreezeCart') || '[]');
        } catch (err) {
            return [];
        }
    }

    /**
     * Save cart to localStorage.
     *
     * @param {Array} cart - Array of cart items
     */
    function saveCart(cart) {
        try {
            localStorage.setItem('cloudyBreezeCart', JSON.stringify(cart));
        } catch (err) {
            console.error('Failed to save cart:', err);
        }
    }

    /**
     * Add an item to the cart.
     *
     * @param {Object} product - Product object
     * @param {Object|null} variant - Selected variant or null
     * @param {number} quantity - Quantity to add
     * @returns {Object} Updated cart
     */
    function addToCart(product, variant, quantity) {
        const cart = getCart();
        const variantId = variant ? variant.id : null;
        const variantName = variant ? variant.variation_name : null;
        const price = variant
            ? parseFloat(product.price) + parseFloat(variant.price_adjustment || 0)
            : parseFloat(product.price);

        // Check if item already exists in cart
        const existingIndex = cart.findIndex(function (item) {
            return item.product_id === product.id && item.variant_id === variantId;
        });

        if (existingIndex > -1) {
            // Update quantity
            cart[existingIndex].quantity += quantity;
            if (cart[existingIndex].quantity > 99) cart[existingIndex].quantity = 99;
        } else {
            // Add new item
            cart.push({
                product_id: product.id,
                product_name: product.name,
                product_slug: product.slug,
                cover_image: product.cover_image || (product.images && product.images.length > 0 ? product.images[0].image_url : ''),
                variant_id: variantId,
                variant_name: variantName,
                price: price,
                quantity: quantity,
            });
        }

        saveCart(cart);
        updateCartCount();
        animateCartCount();

        return cart;
    }

    /**
     * Remove an item from the cart.
     *
     * @param {string} productId - Product ID
     * @param {string|null} variantId - Variant ID or null
     * @returns {Object} Updated cart
     */
    function removeFromCart(productId, variantId) {
        let cart = getCart();

        cart = cart.filter(function (item) {
            return !(item.product_id === productId && item.variant_id === variantId);
        });

        saveCart(cart);
        updateCartCount();

        return cart;
    }

    /**
     * Update item quantity in cart.
     *
     * @param {string} productId - Product ID
     * @param {string|null} variantId - Variant ID or null
     * @param {number} quantity - New quantity
     * @returns {Object} Updated cart
     */
    function updateCartItemQuantity(productId, variantId, quantity) {
        const cart = getCart();
        const item = cart.find(function (item) {
            return item.product_id === productId && item.variant_id === variantId;
        });

        if (item) {
            item.quantity = Math.max(1, Math.min(99, quantity));
        }

        saveCart(cart);
        updateCartCount();

        return cart;
    }

    /**
     * Calculate cart total.
     *
     * @returns {number} Total price of all items
     */
    function getCartTotal() {
        const cart = getCart();
        return cart.reduce(function (total, item) {
            return total + item.price * item.quantity;
        }, 0);
    }

    /**
     * Clear the entire cart.
     */
    function clearCart() {
        localStorage.removeItem('cloudyBreezeCart');
        updateCartCount();
    }

    // ============================================================
    // Store Settings (Footer)
    // ============================================================

    /**
     * Load store settings and populate footer contact info.
     */
    function loadStoreSettings() {
        fetch('/api/settings')
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.data) return;

                var settings = result.data;

                // Footer email
                var footerEmail = document.getElementById('footerEmail');
                if (footerEmail && settings.email) {
                    footerEmail.textContent = settings.email;
                }

                // Footer phone
                var footerPhone = document.getElementById('footerPhone');
                var footerPhoneWrapper = document.getElementById('footerPhoneWrapper');
                if (footerPhone && settings.phone) {
                    footerPhone.textContent = settings.phone;
                } else if (footerPhoneWrapper) {
                    footerPhoneWrapper.style.display = 'none';
                }

                // Footer address
                var footerAddress = document.getElementById('footerAddress');
                var footerAddressWrapper = document.getElementById('footerAddressWrapper');
                if (footerAddress && settings.address) {
                    footerAddress.textContent = settings.address;
                } else if (footerAddressWrapper) {
                    footerAddressWrapper.style.display = 'none';
                }

                // Social links
                var footerSocial = document.getElementById('footerSocial');
                if (footerSocial && settings.social) {
                    var html = '';
                    if (settings.social.facebook) {
                        html += '<a href="' + settings.social.facebook + '" class="social-link" target="_blank" rel="noopener noreferrer" aria-label="Facebook">FB</a>';
                    }
                    if (settings.social.instagram) {
                        html += '<a href="' + settings.social.instagram + '" class="social-link" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>';
                    }
                    if (settings.social.twitter) {
                        html += '<a href="' + settings.social.twitter + '" class="social-link" target="_blank" rel="noopener noreferrer" aria-label="Twitter">TW</a>';
                    }
                    footerSocial.innerHTML = html;
                }
            })
            .catch(function (err) {
                console.error('Error loading store settings:', err);
            });
    }

    // ============================================================
    // Current Year
    // ============================================================

    function setCurrentYear() {
        if (currentYear) {
            currentYear.textContent = new Date().getFullYear();
        }
    }

    // ============================================================
    // Scroll Effects
    // ============================================================

    /**
     * Add shadow to header when scrolling down.
     */
    function initScrollEffects() {
        if (!siteHeader) return;

        var lastScrollY = 0;

        window.addEventListener('scroll', function () {
            var scrollY = window.scrollY;

            if (scrollY > 10) {
                siteHeader.classList.add('scrolled');
            } else {
                siteHeader.classList.remove('scrolled');
            }

            lastScrollY = scrollY;
        }, { passive: true });
    }

    /**
     * Initialize scroll-triggered animations for elements with .animate-on-scroll class.
     */
    function initScrollAnimations() {
        var animatedElements = document.querySelectorAll('.animate-on-scroll');

        if (animatedElements.length === 0) return;

        function checkVisibility() {
            var windowHeight = window.innerHeight;

            animatedElements.forEach(function (el) {
                var rect = el.getBoundingClientRect();
                var isVisible = rect.top < windowHeight - 50;

                if (isVisible) {
                    el.classList.add('visible');
                }
            });
        }

        // Check on load
        checkVisibility();

        // Check on scroll
        window.addEventListener('scroll', checkVisibility, { passive: true });
    }

    // ============================================================
    // Price Formatting Helper
    // ============================================================

    /**
     * Format a number as a price string.
     *
     * @param {number} amount - The amount to format
     * @param {string} [currency='$'] - Currency symbol
     * @returns {string} Formatted price string
     */
    function formatPrice(amount, currency) {
        currency = currency || '$';
        return currency + parseFloat(amount).toFixed(2);
    }

    // ============================================================
    // URL Parameter Helper
    // ============================================================

    /**
     * Get a URL query parameter value by name.
     *
     * @param {string} name - Parameter name
     * @returns {string|null} Parameter value or null
     */
    function getQueryParam(name) {
        var urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // ============================================================
    // Toast Notification Helper
    // ============================================================

    /**
     * Show a temporary toast notification.
     *
     * @param {string} message - Message to display
     * @param {string} [type='info'] - Toast type: 'success', 'error', 'info'
     * @param {number} [duration=3000] - Duration in milliseconds
     */
    function showToast(message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;

        // Remove existing toasts
        var existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');

        document.body.appendChild(toast);

        // Remove after duration
        setTimeout(function () {
            toast.classList.add('hiding');
            setTimeout(function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400);
        }, duration);
    }

    // ============================================================
    // Initialization
    // ============================================================

    function init() {
        setCurrentYear();
        initMobileNav();
        updateCartCount();
        loadStoreSettings();
        initScrollEffects();
        initScrollAnimations();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================================
    // Public API
    // ============================================================

    // Expose functions to other scripts via global namespace
    window.CloudyBreeze = window.CloudyBreeze || {};
    window.CloudyBreeze.updateCartCount = updateCartCount;
    window.CloudyBreeze.animateCartCount = animateCartCount;
    window.CloudyBreeze.getCart = getCart;
    window.CloudyBreeze.saveCart = saveCart;
    window.CloudyBreeze.addToCart = addToCart;
    window.CloudyBreeze.removeFromCart = removeFromCart;
    window.CloudyBreeze.updateCartItemQuantity = updateCartItemQuantity;
    window.CloudyBreeze.getCartTotal = getCartTotal;
    window.CloudyBreeze.clearCart = clearCart;
    window.CloudyBreeze.formatPrice = formatPrice;
    window.CloudyBreeze.getQueryParam = getQueryParam;
    window.CloudyBreeze.showToast = showToast;
})();