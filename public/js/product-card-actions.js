// ============================================================
// CloudyBreeze - Shared Product Card Actions
// ============================================================
// Handles quick Add to Cart / Buy Now actions rendered on
// homepage featured products and the products catalog page.
// ============================================================

(function () {
    'use strict';

    window.CloudyBreezeCardProducts = window.CloudyBreezeCardProducts || {};

    function track(eventType, product, source) {
        try {
            if (!window.CloudyBreezeExperiment || typeof window.CloudyBreezeExperiment.track !== 'function') return;

            window.CloudyBreezeExperiment.track(eventType, {
                product_id: product && product.id ? String(product.id) : null,
                page_path: window.location.pathname,
                metadata: {
                    product_slug: product && product.slug ? product.slug : null,
                    price: Number((parseFloat(product && product.price) || 0).toFixed(2)),
                    quantity: 1,
                    source: source
                }
            });
        } catch (_) {}
    }

    function handleAction(event) {
        var button = event.target.closest('[data-card-action]');
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        var productId = button.getAttribute('data-product-id');
        var product = window.CloudyBreezeCardProducts[String(productId)];

        if (!product || !window.CloudyBreeze || typeof window.CloudyBreeze.addToCart !== 'function') return;

        var variant = product.variants && product.variants.length ? product.variants[0] : null;
        var action = button.getAttribute('data-card-action');

        if (action === 'add') {
            window.CloudyBreeze.addToCart(product, variant, 1);
            track('add_to_cart', product, 'product_card');

            if (typeof window.CloudyBreeze.showToast === 'function') {
                window.CloudyBreeze.showToast('Added to cart!', 'success');
            }
            return;
        }

        if (action === 'buy') {
            track('buy_now_click', product, 'product_card');
            window.CloudyBreeze.addToCart(product, variant, 1);
            window.location.href = '/checkout';
        }
    }

    function init() {
        document.addEventListener('click', handleAction);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();