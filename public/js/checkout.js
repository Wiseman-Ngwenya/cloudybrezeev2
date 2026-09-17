// ============================================================
// CloudyBreeze - Checkout JavaScript
// ============================================================
// Interest-test checkout:
// - Never creates a real order
// - Never starts a real payment
// - Records meaningful checkout intent events
// - Saves submitted customer details to experiment_leads
// ============================================================

(function () {
    'use strict';

    var checkoutForm = document.getElementById('checkoutForm');
    var placeOrderBtn = document.getElementById('placeOrderBtn');
    var checkoutMessage = document.getElementById('checkoutMessage');
    var checkoutContent = document.getElementById('checkoutContent');
    var checkoutSuccess = document.getElementById('checkoutSuccess');
    var successOrderNumber = document.getElementById('successOrderNumber');
    var shippingCountry = document.getElementById('shippingCountry');
    var shippingCountryMessage = document.getElementById('shippingCountryMessage');

    var checkoutStartedTracked = false;
    var checkoutFormStartedTracked = false;
    var leadSaveInProgress = false;

    function ensureExperimentTracker() {
        try {
            if (window.CloudyBreezeExperiment) return;
            if (document.querySelector('script[data-cloudybreeze-experiment="true"]')) return;

            var script = document.createElement('script');
            script.src = '/js/experiment-tracker.js';
            script.async = true;
            script.dataset.cloudybreezeExperiment = 'true';
            script.onerror = function () {};
            document.head.appendChild(script);
        } catch (err) {
            // Experiment tracking is optional and must never break checkout.
        }
    }

    function callExperimentTracker(method, args, callback) {
        var finished = false;

        function finish(result) {
            if (finished) return;
            finished = true;
            callback(result);
        }

        function attempt(attemptNumber) {
            var tracker = window.CloudyBreezeExperiment;

            if (tracker && typeof tracker[method] === 'function') {
                try {
                    Promise.resolve(tracker[method].apply(tracker, args || []))
                        .then(finish)
                        .catch(function () { finish(false); });
                } catch (err) {
                    finish(false);
                }
                return;
            }

            if (attemptNumber < 30) {
                window.setTimeout(function () {
                    attempt(attemptNumber + 1);
                }, 100);
                return;
            }

            finish(false);
        }

        attempt(0);
    }

    function trackExperimentEvent(eventType, metadata) {
        callExperimentTracker('track', [eventType, {
            page_path: window.location.pathname,
            metadata: metadata || {}
        }], function () {
            // Experiment tracking failures must never interrupt checkout.
        });
    }

    function getCurrentCart() {
        if (!window.CloudyBreeze || typeof window.CloudyBreeze.getCart !== 'function') return [];
        var cart = window.CloudyBreeze.getCart();
        return Array.isArray(cart) ? cart : [];
    }

    function getCurrentTotals() {
        if (!window.CloudyBreeze || typeof window.CloudyBreeze.getCartTotals !== 'function') return null;
        return window.CloudyBreeze.getCartTotals();
    }

    function getCartFunnelMetadata() {
        var cart = getCurrentCart();
        var totals = getCurrentTotals();

        if (cart.length === 0 || !totals) return null;

        return {
            item_count: cart.length,
            total_quantity: cart.reduce(function (sum, item) {
                return sum + (Number(item.quantity) || 0);
            }, 0),
            subtotal: Number((Number(totals.subtotal) || 0).toFixed(2)),
            shipping: Number((Number(totals.shippingCost) || 0).toFixed(2)),
            total: Number((Number(totals.total) || 0).toFixed(2)),
            source: 'checkout_page'
        };
    }

    function trackCheckoutStarted() {
        if (checkoutStartedTracked) return;

        var metadata = getCartFunnelMetadata();
        if (!metadata) return;

        checkoutStartedTracked = true;
        trackExperimentEvent('checkout_started', metadata);
    }

    function trackCheckoutFormStarted() {
        if (checkoutFormStartedTracked) return;

        var metadata = getCartFunnelMetadata();
        if (!metadata) return;

        checkoutFormStartedTracked = true;
        trackExperimentEvent('checkout_form_started', metadata);
    }

    function initCheckoutFormStartedTracking() {
        if (!checkoutForm) return;

        // A field focus is the first meaningful indication that the visitor
        // has started entering checkout information. We do not record input.
        checkoutForm.addEventListener('focusin', function (event) {
            var target = event.target;
            if (!target || !/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
            trackCheckoutFormStarted();
        });
    }

    function initPaymentMethod() {
        var options = document.querySelector('.payment-options');
        if (!options) return;

        options.innerHTML =
            '<div class="payment-option">' +
                '<div class="payment-option-content">' +
                    '<span class="payment-option-title">Payment currently unavailable</span>' +
                    '<span class="payment-option-desc">We are currently setting up payment processing for your region. You will not be charged and no order will be placed in this test.</span>' +
                '</div>' +
            '</div>';
    }

    function initShippingCountries() {
        if (!shippingCountry) return Promise.resolve();

        return fetch('/api/settings/shipping-countries')
            .then(function (res) {
                if (!res.ok) throw new Error('Unable to load shipping countries');
                return res.json();
            })
            .then(function (result) {
                if (!result.success) throw new Error('Unable to load shipping countries');

                var countries = Array.isArray(result.data) ? result.data :
                    (result.data && Array.isArray(result.data.countries) ? result.data.countries : []);

                shippingCountry.innerHTML = '<option value="">Select your country</option>';

                countries.forEach(function (country) {
                    var option = document.createElement('option');
                    option.value = country.country_name;
                    option.textContent = country.country_name;
                    option.dataset.countryCode = country.country_code || '';
                    option.dataset.shippingCost = country.shipping_cost != null ? country.shipping_cost : '';
                    option.dataset.minDays = country.estimated_days_min != null ? country.estimated_days_min : '';
                    option.dataset.maxDays = country.estimated_days_max != null ? country.estimated_days_max : '';
                    shippingCountry.appendChild(option);
                });

                shippingCountry.disabled = countries.length === 0;

                if (shippingCountryMessage) {
                    shippingCountryMessage.textContent = countries.length
                        ? 'Shipping is currently available to the countries listed above.'
                        : 'No shipping countries are currently available.';
                }
            })
            .catch(function (err) {
                console.error('Error loading shipping countries:', err);
                shippingCountry.innerHTML = '<option value="">Unable to load countries</option>';
                shippingCountry.disabled = true;
                if (shippingCountryMessage) shippingCountryMessage.textContent = 'Please try refreshing the page.';
            });
    }

    function handleCountryChange() {
        if (!shippingCountry) return;

        shippingCountry.addEventListener('change', function () {
            var option = this.options[this.selectedIndex];

            if (!option || !option.value) {
                if (window.CloudyBreeze && window.CloudyBreeze.setShippingCost) {
                    window.CloudyBreeze.setShippingCost(null);
                }
                return;
            }

            var cost = option.dataset.shippingCost;
            if (window.CloudyBreeze && window.CloudyBreeze.setShippingCost) {
                window.CloudyBreeze.setShippingCost(cost === '' ? null : cost);
            }

            if (shippingCountryMessage) {
                var minDays = option.dataset.minDays;
                var maxDays = option.dataset.maxDays;
                var eta = minDays && maxDays ? ' Estimated delivery: ' + minDays + '–' + maxDays + ' days.' : '';
                shippingCountryMessage.textContent = 'Shipping available to ' + option.value + '.' + eta;
            }
        });
    }

    function buildProductSummary(cart) {
        return cart.slice(0, 20).map(function (item) {
            var quantity = Number(item.quantity) || 1;
            var unitPrice = Number(item.price) || 0;

            return {
                product_id: item.product_id ? String(item.product_id) : null,
                product_name: item.product_name ? String(item.product_name).slice(0, 200) : null,
                variant_id: item.variant_id ? String(item.variant_id).slice(0, 120) : null,
                variant_name: item.variant_name ? String(item.variant_name).slice(0, 200) : null,
                quantity: Math.max(1, Math.min(99, quantity)),
                unit_price: Number(unitPrice.toFixed(2)),
                line_total: Number((unitPrice * quantity).toFixed(2))
            };
        });
    }

    function buildLeadPayload() {
        var cart = getCurrentCart();
        var totals = getCurrentTotals();
        var selectedCountry = shippingCountry ? shippingCountry.options[shippingCountry.selectedIndex] : null;

        if (cart.length === 0 || !totals) return null;

        var nameField = document.getElementById('customerName');
        var emailField = document.getElementById('customerEmail');
        var phoneField = document.getElementById('customerPhone');
        var addressField = document.getElementById('shippingAddress');
        var cityField = document.getElementById('shippingCity');

        return {
            full_name: nameField ? nameField.value.trim() : '',
            email: emailField ? emailField.value.trim() : '',
            phone: phoneField ? (phoneField.value.trim() || null) : null,
            country_code: selectedCountry && selectedCountry.dataset ? (selectedCountry.dataset.countryCode || null) : null,
            country_name: shippingCountry ? shippingCountry.value.trim() : null,
            city: cityField ? cityField.value.trim() : null,
            address: addressField ? addressField.value.trim() : null,
            postal_code: null,
            product_summary: buildProductSummary(cart),
            checkout_subtotal: Number((Number(totals.subtotal) || 0).toFixed(2)),
            checkout_shipping: Number((Number(totals.shippingCost) || 0).toFixed(2)),
            checkout_total: Number((Number(totals.total) || 0).toFixed(2)),
            currency: 'USD'
        };
    }

    function initCheckoutForm() {
        if (!checkoutForm) return;

        checkoutForm.addEventListener('submit', function (e) {
            e.preventDefault();
            hideMessage();
            if (leadSaveInProgress) return;
            if (!validateForm()) return;

            var cartTotals = getCurrentTotals();
            if (!cartTotals || cartTotals.items.length === 0) {
                showMessage('Your cart is empty. Please add items before continuing.', 'error');
                return;
            }

            var leadPayload = buildLeadPayload();
            if (!leadPayload) {
                showMessage('We could not prepare your request. Please refresh the page and try again.', 'error');
                return;
            }

            trackCheckoutFormStarted();
            trackExperimentEvent('payment_attempt', {
                item_count: cartTotals.items.length,
                total_quantity: getCurrentCart().reduce(function (sum, item) {
                    return sum + (Number(item.quantity) || 0);
                }, 0),
                subtotal: Number((Number(cartTotals.subtotal) || 0).toFixed(2)),
                shipping: Number((Number(cartTotals.shippingCost) || 0).toFixed(2)),
                total: Number((Number(cartTotals.total) || 0).toFixed(2)),
                payment_available: false,
                source: 'checkout_submit'
            });

            leadSaveInProgress = true;
            setSubmitting(true);

            callExperimentTracker('saveLead', [leadPayload], function (result) {
                leadSaveInProgress = false;
                setSubmitting(false);

                var leadSaved = !!(result && result.success);

                trackExperimentEvent('payment_unavailable', {
                    lead_saved: leadSaved,
                    reason: 'payment_not_available_for_region',
                    source: 'checkout_submit'
                });

                if (!leadSaved) {
                    showMessage('We could not save your request right now. No payment was taken and no order was placed. Please try again.', 'error');
                    return;
                }

                trackExperimentEvent('checkout_form_completed', {
                    item_count: cartTotals.items.length,
                    total_quantity: getCurrentCart().reduce(function (sum, item) {
                        return sum + (Number(item.quantity) || 0);
                    }, 0),
                    subtotal: Number((Number(cartTotals.subtotal) || 0).toFixed(2)),
                    shipping: Number((Number(cartTotals.shippingCost) || 0).toFixed(2)),
                    total: Number((Number(cartTotals.total) || 0).toFixed(2)),
                    source: 'checkout_submit'
                });

                showExperimentSuccess();
            });
        });
    }

    function validateForm() {
        var requiredFields = [
            { id: 'customerName', name: 'Full Name' },
            { id: 'customerEmail', name: 'Email Address' },
            { id: 'shippingAddress', name: 'Shipping Address' },
            { id: 'shippingCity', name: 'City' },
            { id: 'shippingCountry', name: 'Country' }
        ];

        for (var i = 0; i < requiredFields.length; i++) {
            var field = document.getElementById(requiredFields[i].id);
            if (!field || !field.value.trim()) {
                showMessage('Please fill in the required field: ' + requiredFields[i].name, 'error');
                if (field) field.focus();
                return false;
            }
        }

        var emailField = document.getElementById('customerEmail');
        if (emailField && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value.trim())) {
            showMessage('Please enter a valid email address.', 'error');
            emailField.focus();
            return false;
        }

        var cartTotals = getCurrentTotals();
        if (!cartTotals || cartTotals.items.length === 0) {
            showMessage('Your cart is empty. Please add items before continuing.', 'error');
            return false;
        }

        return true;
    }

    function showMessage(message, type) {
        if (!checkoutMessage) return;
        checkoutMessage.textContent = message;
        checkoutMessage.className = 'form-message ' + (type || 'error');
        checkoutMessage.style.display = 'block';
        checkoutMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideMessage() {
        if (checkoutMessage) checkoutMessage.style.display = 'none';
    }

    function setSubmitting(isSubmitting) {
        if (!placeOrderBtn) return;

        placeOrderBtn.disabled = isSubmitting;
        placeOrderBtn.textContent = isSubmitting
            ? 'Saving your details...'
            : 'Check Payment Availability';
    }

    function showExperimentSuccess() {
        if (checkoutContent) checkoutContent.style.display = 'none';
        if (checkoutSuccess) checkoutSuccess.style.display = 'block';

        var heading = checkoutSuccess ? checkoutSuccess.querySelector('h2') : null;
        if (heading) heading.textContent = 'Thanks — your interest has been recorded';

        var orderLine = checkoutSuccess ? checkoutSuccess.querySelector('.success-order-number') : null;
        if (orderLine) orderLine.style.display = 'none';
        if (successOrderNumber) successOrderNumber.textContent = '';

        var message = checkoutSuccess ? checkoutSuccess.querySelector('p:not(.success-order-number)') : null;
        if (message) {
            message.textContent = 'No payment was taken and no order was placed. We are currently setting up payment processing for your region. We will contact you using the details you provided if payment becomes available.';
        }

        var actions = checkoutSuccess ? checkoutSuccess.querySelector('.success-actions') : null;
        if (actions) {
            actions.innerHTML = '<a href="/products" class="btn btn-primary">Continue Shopping</a>';
        }

        if (checkoutSuccess) checkoutSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function init() {
        ensureExperimentTracker();
        initPaymentMethod();
        initCheckoutFormStartedTracking();

        initShippingCountries().then(function () {
            handleCountryChange();
            initCheckoutForm();
            trackCheckoutStarted();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
