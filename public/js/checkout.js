// ============================================================
// CloudyBreeze E-Commerce System
// Checkout JavaScript
// ============================================================
// Handles the checkout form submission:
// - Form validation
// - Order submission to API
// - Success/error state management
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // DOM Elements
    // ============================================================
    var checkoutForm = document.getElementById('checkoutForm');
    var placeOrderBtn = document.getElementById('placeOrderBtn');
    var checkoutMessage = document.getElementById('checkoutMessage');
    var checkoutContent = document.getElementById('checkoutContent');
    var checkoutSuccess = document.getElementById('checkoutSuccess');
    var successOrderNumber = document.getElementById('successOrderNumber');

    // ============================================================
    // Form Submission
    // ============================================================

    /**
     * Handle checkout form submission.
     */
    function initCheckoutForm() {
        if (!checkoutForm) return;

        checkoutForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Reset message
            hideMessage();

            // Validate form
            if (!validateForm()) {
                return;
            }

            // Get cart totals from cart.js
            var cartTotals = window.CloudyBreeze.getCartTotals();

            if (!cartTotals || cartTotals.items.length === 0) {
                showMessage('Your cart is empty. Please add items before placing an order.', 'error');
                return;
            }

            // Build order data
            var orderData = {
                customer_name: document.getElementById('customerName').value.trim(),
                customer_email: document.getElementById('customerEmail').value.trim(),
                customer_phone: document.getElementById('customerPhone').value.trim() || null,
                shipping_address: document.getElementById('shippingAddress').value.trim(),
                shipping_city: document.getElementById('shippingCity').value.trim(),
                shipping_country: document.getElementById('shippingCountry').value.trim(),
                payment_method: document.querySelector('input[name="payment_method"]:checked').value,
                notes: document.getElementById('orderNotes').value.trim() || null,
                items: cartTotals.items,
            };

            // Disable button and show loading state
            setSubmitting(true);

            // Submit order
            submitOrder(orderData);
        });
    }

    /**
     * Validate all required form fields.
     *
     * @returns {boolean} Whether the form is valid
     */
    function validateForm() {
        var requiredFields = [
            { id: 'customerName', name: 'Full Name' },
            { id: 'customerEmail', name: 'Email Address' },
            { id: 'shippingAddress', name: 'Shipping Address' },
            { id: 'shippingCity', name: 'City' },
            { id: 'shippingCountry', name: 'Country' },
        ];

        // Check required fields
        for (var i = 0; i < requiredFields.length; i++) {
            var field = document.getElementById(requiredFields[i].id);
            if (!field || !field.value.trim()) {
                showMessage('Please fill in the required field: ' + requiredFields[i].name, 'error');
                if (field) field.focus();
                return false;
            }
        }

        // Validate email format
        var emailField = document.getElementById('customerEmail');
        if (emailField) {
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailField.value.trim())) {
                showMessage('Please enter a valid email address.', 'error');
                emailField.focus();
                return false;
            }
        }

        // Validate payment method selection
        var paymentMethod = document.querySelector('input[name="payment_method"]:checked');
        if (!paymentMethod) {
            showMessage('Please select a payment method.', 'error');
            return false;
        }

        // Validate cart has items
        var cartTotals = window.CloudyBreeze.getCartTotals();
        if (!cartTotals || cartTotals.items.length === 0) {
            showMessage('Your cart is empty. Please add items before placing an order.', 'error');
            return false;
        }

        return true;
    }

    /**
     * Submit the order to the API.
     *
     * @param {Object} orderData - The complete order payload
     */
    function submitOrder(orderData) {
        fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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

                // Order placed successfully
                var order = result.data;
                showSuccess(order.order_number);

                // Clear the cart
                window.CloudyBreeze.clearCart();
                window.CloudyBreeze.updateCartCount();
            })
            .catch(function (err) {
                console.error('Error submitting order:', err);
                setSubmitting(false);
                showMessage('Network error. Please check your connection and try again.', 'error');
            });
    }

    // ============================================================
    // UI State Management
    // ============================================================

    /**
     * Show a message in the form message area.
     *
     * @param {string} message - Message text
     * @param {string} [type='error'] - Message type: 'error' or 'success'
     */
    function showMessage(message, type) {
        if (!checkoutMessage) return;

        type = type || 'error';
        checkoutMessage.textContent = message;
        checkoutMessage.className = 'form-message ' + type;
        checkoutMessage.style.display = 'block';

        // Scroll to message
        checkoutMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Hide the form message.
     */
    function hideMessage() {
        if (checkoutMessage) {
            checkoutMessage.style.display = 'none';
        }
    }

    /**
     * Set the submitting state (disable button, show loading).
     *
     * @param {boolean} isSubmitting - Whether the form is being submitted
     */
    function setSubmitting(isSubmitting) {
        if (placeOrderBtn) {
            placeOrderBtn.disabled = isSubmitting;
            placeOrderBtn.textContent = isSubmitting ? 'Placing Order...' : 'Place Order';
        }
    }

    /**
     * Show the success state after order placement.
     *
     * @param {string} orderNumber - The order number to display
     */
    function showSuccess(orderNumber) {
        if (checkoutContent) checkoutContent.style.display = 'none';
        if (checkoutSuccess) checkoutSuccess.style.display = 'block';
        if (successOrderNumber) successOrderNumber.textContent = orderNumber;

        // Scroll to success message
        if (checkoutSuccess) {
            checkoutSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ============================================================
    // Initialization
    // ============================================================

    function init() {
        initCheckoutForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();