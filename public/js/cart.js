// ============================================================
// CloudyBreeze E-Commerce System
// Cart JavaScript
// ============================================================
// Handles cart display and management on the checkout page:
// - Render cart items from localStorage
// - Update quantities inline
// - Remove items
// - Calculate and display totals
// - Load shipping cost from store settings
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // State
    // ============================================================
    var shippingCost = 0;
    var freeShippingThreshold = null;
    var shippingCostOverride = null;

    // ============================================================
    // DOM Elements
    // ============================================================
    var checkoutEmpty = document.getElementById('checkoutEmpty');
    var checkoutContent = document.getElementById('checkoutContent');
    var cartItems = document.getElementById('cartItems');
    var summarySubtotal = document.getElementById('summarySubtotal');
    var summaryShipping = document.getElementById('summaryShipping');
    var summaryTotal = document.getElementById('summaryTotal');
    var freeShippingNote = document.getElementById('freeShippingNote');

    // ============================================================
    // Interest-test experiment tracking
    // ============================================================

    function ensureExperimentTracker() {
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

    function trackExperimentEvent(eventType, productId, metadata) {
        function attempt(attemptNumber) {
            var tracker = window.CloudyBreezeExperiment;

            if (tracker && typeof tracker.track === 'function') {
                try {
                    tracker.track(eventType, {
                        product_id: productId ? String(productId) : null,
                        page_path: window.location.pathname,
                        metadata: metadata || {}
                    });
                } catch (err) {
                    // Experiment tracking must never interrupt a customer action.
                }
                return;
            }

            if (attemptNumber < 30) {
                window.setTimeout(function () {
                    attempt(attemptNumber + 1);
                }, 100);
            }
        }

        attempt(0);
    }

    function trackCartView(cart) {
        if (!Array.isArray(cart) || cart.length === 0) return;

        var totalQuantity = cart.reduce(function (sum, item) {
            return sum + (Number(item.quantity) || 0);
        }, 0);

        var subtotal = cart.reduce(function (sum, item) {
            return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0));
        }, 0);

        trackExperimentEvent('cart_view', null, {
            item_count: cart.length,
            total_quantity: totalQuantity,
            subtotal: Number(subtotal.toFixed(2))
        });
    }

    function trackRemovedItem(item) {
        if (!item) return;

        trackExperimentEvent('remove_from_cart', item.product_id, {
            product_name: item.product_name || null,
            quantity: Number(item.quantity) || 1,
            unit_price: Number((Number(item.price) || 0).toFixed(2)),
            variant_id: item.variant_id || null,
            variant_name: item.variant_name || null,
            source: 'cart'
        });
    }

    // ============================================================
    // Load Cart
    // ============================================================

    /**
     * Initialize the checkout page.
     * Loads cart, store settings, and renders the UI.
     */
    function initCart() {
        ensureExperimentTracker();

        var cart = window.CloudyBreeze.getCart();

        if (cart.length === 0) {
            showEmptyCart();
            return;
        }

        trackCartView(cart);

        loadStoreSettings()
            .then(function () {
                renderCart(cart);
                updateTotals(cart);
            })
            .catch(function (err) {
                console.error('Error initializing cart:', err);
                renderCart(cart);
                updateTotals(cart);
            });
    }

    /**
     * Load store settings for shipping cost and free shipping threshold.
     *
     * @returns {Promise} Resolves when settings are loaded
     */
    function loadStoreSettings() {
        return fetch('/api/settings')
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (result.success && result.data) {
                    shippingCost = parseFloat(result.data.shippingCost) || 0;
                    freeShippingThreshold = result.data.freeShippingThreshold
                        ? parseFloat(result.data.freeShippingThreshold)
                        : null;
                }
            });
    }

    /**
     * Set or clear a shipping cost override selected by the customer.
     *
     * @param {number|null} value - Shipping cost override or null to reset
     */
    function setShippingCost(value) {
        if (value === null || value === undefined || value === '') {
            shippingCostOverride = null;
        } else {
            var parsed = parseFloat(value);
            shippingCostOverride = isNaN(parsed) ? null : parsed;
        }

        refreshCartDisplay();
    }

    // ============================================================
    // Render Cart
    // ============================================================

    /**
     * Render cart items in the order summary.
     *
     * @param {Array} cart - Array of cart items
     */
    function renderCart(cart) {
        if (checkoutEmpty) checkoutEmpty.style.display = 'none';
        if (checkoutContent) checkoutContent.style.display = 'block';
        if (!cartItems) return;

        cartItems.innerHTML = cart.map(function (item, index) {
            var imageHtml = '';
            if (item.cover_image) {
                imageHtml = '<img src="' + item.cover_image + '" alt="' + item.product_name + '" loading="lazy">';
            }

            var variantHtml = '';
            if (item.variant_name) {
                variantHtml = '<p class="cart-item-variant">' + item.variant_name + '</p>';
            }

            return '<div class="cart-item" data-index="' + index + '">' +
                '<div class="cart-item-image">' + imageHtml + '</div>' +
                '<div class="cart-item-details">' +
                    '<h4 class="cart-item-name">' + item.product_name + '</h4>' +
                    variantHtml +
                    '<div class="cart-item-meta">' +
                        '<div class="quantity-selector" style="margin-bottom:0;">' +
                            '<button class="quantity-btn cart-qty-decrease" data-index="' + index + '" aria-label="Decrease quantity">-</button>' +
                            '<input type="number" class="quantity-input cart-qty-input" data-index="' + index + '" value="' + item.quantity + '" min="1" max="99" aria-label="Item quantity">' +
                            '<button class="quantity-btn cart-qty-increase" data-index="' + index + '" aria-label="Increase quantity">+</button>' +
                        '</div>' +
                        '<span class="cart-item-price">$' + (item.price * item.quantity).toFixed(2) + '</span>' +
                    '</div>' +
                    '<button class="btn btn-sm btn-outline cart-remove-btn" data-index="' + index + '" style="margin-top:8px;color:#dc3545;border-color:#dc3545;">Remove</button>' +
                '</div>' +
            '</div>';
        }).join('');

        // Attach event handlers
        attachCartEvents();
    }

    /**
     * Attach event handlers to quantity buttons and remove buttons.
     */
    function attachCartEvents() {
        if (!cartItems) return;

        // Quantity decrease buttons
        cartItems.querySelectorAll('.cart-qty-decrease').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-index'));
                var cart = window.CloudyBreeze.getCart();
                if (cart[index] && cart[index].quantity > 1) {
                    cart[index].quantity--;
                    window.CloudyBreeze.saveCart(cart);
                    refreshCartDisplay();
                }
            });
        });

        // Quantity increase buttons
        cartItems.querySelectorAll('.cart-qty-increase').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-index'));
                var cart = window.CloudyBreeze.getCart();
                if (cart[index] && cart[index].quantity < 99) {
                    cart[index].quantity++;
                    window.CloudyBreeze.saveCart(cart);
                    refreshCartDisplay();
                }
            });
        });

        // Quantity input fields
        cartItems.querySelectorAll('.cart-qty-input').forEach(function (input) {
            input.addEventListener('change', function () {
                var index = parseInt(this.getAttribute('data-index'));
                var cart = window.CloudyBreeze.getCart();
                var val = parseInt(this.value);
                if (isNaN(val) || val < 1) {
                    val = 1;
                } else if (val > 99) {
                    val = 99;
                }
                if (cart[index]) {
                    cart[index].quantity = val;
                    window.CloudyBreeze.saveCart(cart);
                    refreshCartDisplay();
                }
            });
        });

        // Remove buttons
        cartItems.querySelectorAll('.cart-remove-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-index'));
                var cart = window.CloudyBreeze.getCart();
                if (cart[index]) {
                    var item = cart[index];
                    trackRemovedItem(item);
                    window.CloudyBreeze.removeFromCart(item.product_id, item.variant_id);
                    refreshCartDisplay();
                }
            });
        });
    }

    /**
     * Refresh the entire cart display after a change.
     */
    function refreshCartDisplay() {
        var cart = window.CloudyBreeze.getCart();

        if (cart.length === 0) {
            showEmptyCart();
            return;
        }

        renderCart(cart);
        updateTotals(cart);
        window.CloudyBreeze.updateCartCount();
    }

    // ============================================================
    // Totals Calculation
    // ============================================================

    /**
     * Calculate and display order totals.
     *
     * @param {Array} cart - Array of cart items
     */
    function updateTotals(cart) {
        var subtotal = cart.reduce(function (total, item) {
            return total + item.price * item.quantity;
        }, 0);

        // Determine shipping cost
        var effectiveShippingCost = shippingCostOverride !== null ? shippingCostOverride : shippingCost;

        // Check free shipping threshold
        if (freeShippingThreshold !== null && subtotal >= freeShippingThreshold) {
            effectiveShippingCost = 0;
            if (freeShippingNote) freeShippingNote.style.display = 'flex';
        } else {
            if (freeShippingNote) freeShippingNote.style.display = 'none';
        }

        var total = subtotal + effectiveShippingCost;

        // Update display
        if (summarySubtotal) summarySubtotal.textContent = '$' + subtotal.toFixed(2);
        if (summaryShipping) summaryShipping.textContent = effectiveShippingCost === 0 ? 'FREE' : '$' + effectiveShippingCost.toFixed(2);
        if (summaryTotal) summaryTotal.textContent = '$' + total.toFixed(2);

        // Return values for checkout form
        return {
            subtotal: subtotal,
            shippingCost: effectiveShippingCost,
            total: total,
        };
    }

    /**
     * Get current cart totals for order submission.
     *
     * @returns {Object} Cart totals { subtotal, shippingCost, total, items }
     */
    function getCartTotals() {
        var cart = window.CloudyBreeze.getCart();
        var totals = updateTotals(cart);

        return {
            subtotal: totals.subtotal,
            shippingCost: totals.shippingCost,
            total: totals.total,
            items: cart.map(function (item) {
                return {
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                };
            }),
        };
    }

    // ============================================================
    // UI State Management
    // ============================================================

    function showEmptyCart() {
        if (checkoutEmpty) checkoutEmpty.style.display = 'block';
        if (checkoutContent) checkoutContent.style.display = 'none';
    }

    // ============================================================
    // Public API
    // ============================================================

    window.CloudyBreeze = window.CloudyBreeze || {};
    window.CloudyBreeze.initCart = initCart;
    window.CloudyBreeze.getCartTotals = getCartTotals;
    window.CloudyBreeze.refreshCartDisplay = refreshCartDisplay;
    window.CloudyBreeze.setShippingCost = setShippingCost;

    // ============================================================
    // Initialization
    // ============================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCart);
    } else {
        initCart();
    }
})();