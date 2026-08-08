// ============================================================
// CloudyBreeze E-Commerce System
// Checkout JavaScript
// ============================================================
// Handles checkout country selection and order submission.
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

    function initShippingCountries() {
        if (!shippingCountry) return Promise.resolve();

        return fetch('/api/settings/shipping-countries')
            .then(function (res) {
                if (!res.ok) throw new Error('Unable to load shipping countries');
                return res.json();
            })
            .then(function (result) {
                if (!result.success) throw new Error('Unable to load shipping countries');

                var countries = Array.isArray(result.data)
                    ? result.data
                    : (result.data && Array.isArray(result.data.countries) ? result.data.countries : []);

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
                if (shippingCountryMessage) {
                    shippingCountryMessage.textContent = 'Please try refreshing the page.';
                }
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

            var orderData = {
                customer_name: document.getElementById('customerName').value.trim(),
                customer_email: document.getElementById('customerEmail').value.trim(),
                customer_phone: document.getElementById('customerPhone').value.trim() || null,
                shipping_address: document.getElementById('shippingAddress').value.trim(),
                shipping_city: document.getElementById('shippingCity').value.trim(),
                shipping_country: shippingCountry.value.trim(),
                shipping_country_code: selectedCountry && selectedCountry.dataset ? (selectedCountry.dataset.countryCode || null) : null,
                shipping_cost: cartTotals.shippingCost,
                payment_method: document.querySelector('input[name="payment_method"]:checked').value,
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
        if (emailField) {
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailField.value.trim())) {
                showMessage('Please enter a valid email address.', 'error');
                emailField.focus();
                return false;
            }
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                setSubmitting(false);
                if (!result.success) {
                    var errorMsg = result.error ? result.error.message : 'Failed to place order. Please try again.';
                    showMessage(errorMsg, 'error');
                    return;
                }

                var order = result.data;
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

    function showMessage(message, type) {
        if (!checkoutMessage) return;
        type = type || 'error';
        checkoutMessage.textContent = message;
        checkoutMessage.className = 'form-message ' + type;
        checkoutMessage.style.display = 'block';
        checkoutMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideMessage() {
        if (checkoutMessage) checkoutMessage.style.display = 'none';
    }

    function setSubmitting(isSubmitting) {
        if (placeOrderBtn) {
            placeOrderBtn.disabled = isSubmitting;
            placeOrderBtn.textContent = isSubmitting ? 'Placing Order...' : 'Place Order';
        }
    }

    function showSuccess(orderNumber) {
        if (checkoutContent) checkoutContent.style.display = 'none';
        if (checkoutSuccess) checkoutSuccess.style.display = 'block';
        if (successOrderNumber) successOrderNumber.textContent = orderNumber;
        if (checkoutSuccess) checkoutSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function init() {
        initShippingCountries().then(function () {
            handleCountryChange();
            initCheckoutForm();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();