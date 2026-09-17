// ============================================================
// CloudyBreeze - Checkout JavaScript
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

    function trackExperimentEvent(eventType, metadata) {
        function attempt(attemptNumber) {
            var tracker = window.CloudyBreezeExperiment;
            if (tracker && typeof tracker.track === 'function') {
                try {
                    tracker.track(eventType, {
                        page_path: window.location.pathname,
                        metadata: metadata || {}
                    });
                } catch (err) {
                    // Experiment tracking must never interrupt checkout.
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

    function trackCheckoutStarted() {
        if (checkoutStartedTracked || !window.CloudyBreeze || typeof window.CloudyBreeze.getCart !== 'function') return;

        var cart = window.CloudyBreeze.getCart();
        if (!Array.isArray(cart) || cart.length === 0) return;

        checkoutStartedTracked = true;

        var totalQuantity = cart.reduce(function (sum, item) {
            return sum + (Number(item.quantity) || 0);
        }, 0);

        var subtotal = cart.reduce(function (sum, item) {
            return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0));
        }, 0);

        trackExperimentEvent('checkout_started', {
            item_count: cart.length,
            total_quantity: totalQuantity,
            subtotal: Number(subtotal.toFixed(2)),
            source: 'checkout_page'
        });
    }

    function initPaymentMethod() {
        var options = document.querySelector('.payment-options');
        if (!options) return;

        options.innerHTML = '';
        var label = document.createElement('label');
        label.className = 'payment-option';
        label.innerHTML = '<input type="radio" name="payment_method" value="mojapos" checked>' +
            '<div class="payment-option-content">' +
            '<span class="payment-option-title">Pay securely with MojaPOS</span>' +
            '<span class="payment-option-desc">You will be redirected to MojaPOS secure checkout. Available payment methods are determined by your enabled providers.</span>' +
            '</div>';
        options.appendChild(label);
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
                if (window.CloudyBreeze && window.CloudyBreeze.setShippingCost) window.CloudyBreeze.setShippingCost(null);
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

    function initCheckoutForm() {
        if (!checkoutForm) return;
        checkoutForm.addEventListener('submit', function (e) {
            e.preventDefault();
            hideMessage();
            if (!validateForm()) return;

            var cartTotals = window.CloudyBreeze.getCartTotals();
            if (!cartTotals || cartTotals.items.length === 0) {
                showMessage('Your cart is empty. Please add items before placing an order.', 'error');
                return;
            }

            var selectedCountry = shippingCountry ? shippingCountry.options[shippingCountry.selectedIndex] : null;
            var paymentMethod = document.querySelector('input[name="payment_method"]:checked');
            var orderData = {
                customer_name: document.getElementById('customerName').value.trim(),
                customer_email: document.getElementById('customerEmail').value.trim(),
                customer_phone: document.getElementById('customerPhone').value.trim() || null,
                shipping_address: document.getElementById('shippingAddress').value.trim(),
                shipping_city: document.getElementById('shippingCity').value.trim(),
                shipping_country: shippingCountry.value.trim(),
                shipping_country_code: selectedCountry && selectedCountry.dataset ? (selectedCountry.dataset.countryCode || null) : null,
                shipping_cost: cartTotals.shippingCost,
                payment_method: paymentMethod ? paymentMethod.value : 'mojapos',
                notes: document.getElementById('orderNotes').value.trim() || null,
                items: cartTotals.items,
            };

            setSubmitting(true);
            submitOrder(orderData);
        });
    }

    function validateForm() {
        var requiredFields = [
            { id: 'customerName', name: 'Full Name' },
            { id: 'customerEmail', name: 'Email Address' },
            { id: 'shippingAddress', name: 'Shipping Address' },
            { id: 'shippingCity', name: 'City' },
            { id: 'shippingCountry', name: 'Country' },
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
        var paymentMethod = document.querySelector('input[name="payment_method"]:checked');
        if (!paymentMethod) {
            showMessage('Please select a payment method.', 'error');
            return false;
        }
        var cartTotals = window.CloudyBreeze.getCartTotals();
        if (!cartTotals || cartTotals.items.length === 0) {
            showMessage('Your cart is empty. Please add items before placing an order.', 'error');
            return false;
        }
        return true;
    }

    function submitOrder(orderData) {
        fetch('/api/orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData),
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success) {
                    setSubmitting(false);
                    showMessage(result.error ? result.error.message : 'Failed to place order. Please try again.', 'error');
                    return;
                }

                var order = result.data;
                if (orderData.payment_method === 'mojapos') {
                    return createMojaPOSPayment(order.id, order.order_number);
                }

                setSubmitting(false);
                showSuccess(order.order_number);
                window.CloudyBreeze.clearCart();
                window.CloudyBreeze.updateCartCount();
            })
            .catch(function (err) {
                console.error('Error submitting order:', err);
                setSubmitting(false);
                showMessage('Network error. Please check your connection and try again.', 'error');
            });
    }

    function createMojaPOSPayment(orderId, orderNumber) {
        return fetch('/api/orders/payment/' + encodeURIComponent(orderId), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                setSubmitting(false);
                if (!result.success || !result.data || !result.data.payment_checkout_url) {
                    showMessage(result.error ? result.error.message : 'Unable to start secure payment checkout.', 'error');
                    return;
                }
                window.CloudyBreeze.clearCart();
                window.CloudyBreeze.updateCartCount();
                window.location.href = result.data.payment_checkout_url;
            })
            .catch(function (err) {
                console.error('Error creating MojaPOS checkout:', err);
                setSubmitting(false);
                showMessage('Unable to start payment. Please try again.', 'error');
            });
    }

    function showMessage(message, type) {
        if (!checkoutMessage) return;
        checkoutMessage.textContent = message;
        checkoutMessage.className = 'form-message ' + (type || 'error');
        checkoutMessage.style.display = 'block';
        checkoutMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function hideMessage() { if (checkoutMessage) checkoutMessage.style.display = 'none'; }
    function setSubmitting(isSubmitting) {
        if (placeOrderBtn) {
            placeOrderBtn.disabled = isSubmitting;
            placeOrderBtn.textContent = isSubmitting ? 'Preparing Secure Payment...' : 'Place Order';
        }
    }
    function showSuccess(orderNumber) {
        if (checkoutContent) checkoutContent.style.display = 'none';
        if (checkoutSuccess) checkoutSuccess.style.display = 'block';
        if (successOrderNumber) successOrderNumber.textContent = orderNumber;
        if (checkoutSuccess) checkoutSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handlePaymentReturn() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('payment') !== 'return' && !params.get('transactionId')) return;
        var transactionId = params.get('transactionId');
        if (checkoutContent) checkoutContent.style.display = 'none';
        if (checkoutSuccess) checkoutSuccess.style.display = 'block';
        if (successOrderNumber) successOrderNumber.textContent = 'Payment ' + (transactionId ? 'submitted' : 'processing');
        var successText = checkoutSuccess ? checkoutSuccess.querySelector('p:not(.success-order-number)') : null;
        if (successText) successText.textContent = 'Your payment is being confirmed. We will update your order once MojaPOS confirms the transaction.';
    }

    function init() {
        ensureExperimentTracker();
        initPaymentMethod();
        handlePaymentReturn();
        initShippingCountries().then(function () {
            handleCountryChange();
            initCheckoutForm();
            trackCheckoutStarted();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
