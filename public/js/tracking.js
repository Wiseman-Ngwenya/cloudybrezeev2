// ============================================================
// CloudyBreeze E-Commerce System
// Order Tracking JavaScript
// ============================================================
// Handles order tracking functionality:
// - Order lookup by order number
// - Display order details with progress tracker
// - Loading and error states
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // DOM Elements
    // ============================================================
    var trackingForm = document.getElementById('trackingForm');
    var orderNumberInput = document.getElementById('orderNumber');
    var trackingLoading = document.getElementById('trackingLoading');
    var trackingError = document.getElementById('trackingError');
    var trackingErrorMessage = document.getElementById('trackingErrorMessage');
    var trackingResult = document.getElementById('trackingResult');

    // Result elements
    var resultOrderNumber = document.getElementById('resultOrderNumber');
    var resultStatusBadge = document.getElementById('resultStatusBadge');
    var resultStatus = document.getElementById('resultStatus');
    var resultPaymentMethod = document.getElementById('resultPaymentMethod');
    var resultPaymentStatus = document.getElementById('resultPaymentStatus');
    var resultDate = document.getElementById('resultDate');
    var resultCustomerName = document.getElementById('resultCustomerName');
    var resultShippingAddress = document.getElementById('resultShippingAddress');
    var resultShippingCity = document.getElementById('resultShippingCity');
    var resultShippingCountry = document.getElementById('resultShippingCountry');
    var resultOrderItems = document.getElementById('resultOrderItems');
    var resultSubtotal = document.getElementById('resultSubtotal');
    var resultShippingCost = document.getElementById('resultShippingCost');
    var resultTotal = document.getElementById('resultTotal');
    var orderProgress = document.getElementById('orderProgress');
    var orderCancelledNotice = document.getElementById('orderCancelledNotice');

    // ============================================================
    // Status Configuration
    // ============================================================

    var STATUS_LABELS = {
        pending: 'Pending',
        confirmed: 'Confirmed',
        processing: 'Processing',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
    };

    var PAYMENT_STATUS_LABELS = {
        pending: 'Pending',
        paid: 'Paid',
        failed: 'Failed',
        refunded: 'Refunded',
    };

    var PAYMENT_METHOD_LABELS = {
        bank_transfer: 'Bank Transfer',
        paypal: 'PayPal',
    };

    var PROGRESS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

    // ============================================================
    // Track Order
    // ============================================================

    /**
     * Initialize the tracking form submission handler.
     */
    function initTrackingForm() {
        if (!trackingForm) return;

        trackingForm.addEventListener('submit', function (e) {
            e.preventDefault();

            var orderNumber = orderNumberInput ? orderNumberInput.value.trim() : '';

            if (!orderNumber) {
                showError('Please enter your order number.');
                return;
            }

            // Basic format validation
            if (!/^CB-\d{10}$/.test(orderNumber)) {
                showError('Please enter a valid order number (e.g., CB-2026000125).');
                return;
            }

            lookupOrder(orderNumber);
        });

        // Check for order number in URL query params
        var urlParams = new URLSearchParams(window.location.search);
        var orderFromUrl = urlParams.get('order');
        if (orderFromUrl) {
            if (orderNumberInput) orderNumberInput.value = orderFromUrl;
            lookupOrder(orderFromUrl);
        }
    }

    /**
     * Look up an order by order number from the API.
     *
     * @param {string} orderNumber - The order number to look up
     */
    function lookupOrder(orderNumber) {
        // Reset states
        hideAllStates();
        showLoading();

        fetch('/api/orders/track/' + encodeURIComponent(orderNumber))
            .then(function (res) { return res.json(); })
            .then(function (result) {
                hideLoading();

                if (!result.success || !result.data) {
                    showError('We couldn\'t find an order with that number. Please check your order number and try again.');
                    return;
                }

                renderOrder(result.data);
            })
            .catch(function (err) {
                console.error('Error looking up order:', err);
                hideLoading();
                showError('Unable to look up your order. Please try again later.');
            });
    }

    // ============================================================
    // Render Order
    // ============================================================

    /**
     * Render the order details from the API response.
     *
     * @param {Object} order - Order data from API
     */
    function renderOrder(order) {
        // Show result section
        if (trackingResult) trackingResult.style.display = 'block';

        // Order number
        if (resultOrderNumber) resultOrderNumber.textContent = 'Order #' + order.orderNumber;

        // Status badge
        if (resultStatusBadge) {
            resultStatusBadge.textContent = STATUS_LABELS[order.status] || order.status;
            resultStatusBadge.className = 'order-status-badge ' + order.status;
        }

        // Status
        if (resultStatus) resultStatus.textContent = STATUS_LABELS[order.status] || order.status;

        // Payment method
        if (resultPaymentMethod) {
            resultPaymentMethod.textContent = PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod;
        }

        // Payment status
        if (resultPaymentStatus) {
            resultPaymentStatus.textContent = PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus;
        }

        // Date
        if (resultDate && order.createdAt) {
            var date = new Date(order.createdAt);
            resultDate.textContent = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }

        // Customer name
        if (resultCustomerName) resultCustomerName.textContent = order.customerName;

        // Shipping address
        if (resultShippingAddress) resultShippingAddress.textContent = order.shippingAddress;
        if (resultShippingCity) resultShippingCity.textContent = order.shippingCity;
        if (resultShippingCountry) resultShippingCountry.textContent = order.shippingCountry;

        // Order items
        renderOrderItems(order.items);

        // Totals
        if (resultSubtotal) resultSubtotal.textContent = '$' + parseFloat(order.subtotal).toFixed(2);
        if (resultShippingCost) resultShippingCost.textContent = parseFloat(order.shippingCost) === 0 ? 'FREE' : '$' + parseFloat(order.shippingCost).toFixed(2);
        if (resultTotal) resultTotal.textContent = '$' + parseFloat(order.total).toFixed(2);

        // Progress tracker
        renderProgressTracker(order.status);

        // Cancelled notice
        if (orderCancelledNotice) {
            if (order.status === 'cancelled') {
                orderCancelledNotice.style.display = 'block';
            } else {
                orderCancelledNotice.style.display = 'none';
            }
        }

        // Scroll to result
        if (trackingResult) {
            trackingResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Render the order items list.
     *
     * @param {Array} items - Array of order items
     */
    function renderOrderItems(items) {
        if (!resultOrderItems) return;

        if (!items || items.length === 0) {
            resultOrderItems.innerHTML = '<p>No items found.</p>';
            return;
        }

        resultOrderItems.innerHTML = items.map(function (item) {
            var variantHtml = '';
            if (item.variant_name) {
                variantHtml = '<span class="order-item-variant">' + item.variant_name + '</span>';
            }

            return '<div class="order-item-row">' +
                '<div class="order-item-info">' +
                    '<span class="order-item-name">' + item.product_name + '</span>' +
                    variantHtml +
                '</div>' +
                '<span class="order-item-qty">x' + item.quantity + '</span>' +
                '<span class="order-item-line-total">$' + parseFloat(item.line_total).toFixed(2) + '</span>' +
            '</div>';
        }).join('');
    }

    /**
     * Render the order progress tracker.
     * Highlights completed steps based on current status.
     *
     * @param {string} status - Current order status
     */
    function renderProgressTracker(status) {
        if (!orderProgress) return;

        if (status === 'cancelled') {
            // Hide progress for cancelled orders
            orderProgress.style.display = 'none';
            return;
        }

        orderProgress.style.display = 'flex';

        var currentStepIndex = PROGRESS_STEPS.indexOf(status);

        var steps = orderProgress.querySelectorAll('.progress-step');
        steps.forEach(function (step, index) {
            var stepStatus = step.getAttribute('data-step');

            // Reset classes
            step.classList.remove('completed', 'current');

            if (PROGRESS_STEPS.indexOf(stepStatus) < currentStepIndex) {
                step.classList.add('completed');
            } else if (PROGRESS_STEPS.indexOf(stepStatus) === currentStepIndex) {
                step.classList.add('current');
            }
        });
    }

    // ============================================================
    // UI State Management
    // ============================================================

    function showLoading() {
        if (trackingLoading) trackingLoading.style.display = 'block';
        if (trackingError) trackingError.style.display = 'none';
        if (trackingResult) trackingResult.style.display = 'none';
    }

    function hideLoading() {
        if (trackingLoading) trackingLoading.style.display = 'none';
    }

    function showError(message) {
        hideLoading();
        if (trackingError) trackingError.style.display = 'block';
        if (trackingErrorMessage) trackingErrorMessage.textContent = message || 'Order not found.';
        if (trackingResult) trackingResult.style.display = 'none';
    }

    function hideAllStates() {
        if (trackingLoading) trackingLoading.style.display = 'none';
        if (trackingError) trackingError.style.display = 'none';
        if (trackingResult) trackingResult.style.display = 'none';
    }

    // ============================================================
    // Initialization
    // ============================================================

    function init() {
        initTrackingForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();