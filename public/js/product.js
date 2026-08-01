// ============================================================
// CloudyBreeze E-Commerce System
// Single Product Detail JavaScript
// ============================================================
// Handles product detail page functionality:
// - Load product by slug from URL
// - Gallery image switching
// - Variant selection
// - Quantity selector
// - Add to cart
// - Related products
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // State
    // ============================================================
    var product = null;
    var selectedVariant = null;
    var quantity = 1;

    // ============================================================
    // DOM Elements
    // ============================================================
    var productLoading = document.getElementById('productLoading');
    var productError = document.getElementById('productError');
    var productErrorMessage = document.getElementById('productErrorMessage');
    var productDetail = document.getElementById('productDetail');

    // Product detail elements
    var galleryMainImage = document.getElementById('galleryMainImage');
    var galleryThumbnails = document.getElementById('galleryThumbnails');
    var productCategoryTag = document.getElementById('productCategoryTag');
    var productName = document.getElementById('productName');
    var productPrice = document.getElementById('productPrice');
    var productComparePrice = document.getElementById('productComparePrice');
    var productDiscountBadge = document.getElementById('productDiscountBadge');
    var productShortDesc = document.getElementById('productShortDesc');
    var productVariants = document.getElementById('productVariants');
    var variantsOptions = document.getElementById('variantsOptions');
    var quantityInput = document.getElementById('quantityInput');
    var addToCartBtn = document.getElementById('addToCartBtn');
    var addToCartPrice = document.getElementById('addToCartPrice');
    var cartMessage = document.getElementById('cartMessage');
    var productMeta = document.getElementById('productMeta');
    var productDescription = document.getElementById('productDescription');
    var descriptionContent = document.getElementById('descriptionContent');

    // Related products
    var relatedSection = document.getElementById('relatedSection');
    var relatedProducts = document.getElementById('relatedProducts');

    // Breadcrumb
    var breadcrumbCategory = document.getElementById('breadcrumbCategory');
    var breadcrumbCategorySep = document.getElementById('breadcrumbCategorySep');
    var breadcrumbCurrent = document.getElementById('breadcrumbCurrent');

    // ============================================================
    // Load Product
    // ============================================================

    /**
     * Extract product slug from the current URL path.
     * Expected format: /products/slug-name
     *
     * @returns {string} Product slug
     */
    function getSlugFromUrl() {
        var path = window.location.pathname;
        var parts = path.replace(/\/+$/, '').split('/');
        return parts[parts.length - 1];
    }

    /**
     * Fetch product details from the API.
     */
    function loadProduct() {
        var slug = getSlugFromUrl();

        if (!slug) {
            showError('Product not found.');
            return;
        }

        showLoading();

        fetch('/api/products/' + encodeURIComponent(slug))
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.data) {
                    showError('The product you are looking for does not exist or has been removed.');
                    return;
                }

                product = result.data;
                hideLoading();
                renderProduct();
                loadRelatedProducts();
            })
            .catch(function (err) {
                console.error('Error loading product:', err);
                showError('Unable to load product details. Please try again later.');
            });
    }

    // ============================================================
    // Render Product
    // ============================================================

    function renderProduct() {
        if (!product) return;

        // Show product detail section
        if (productDetail) productDetail.style.display = 'block';

        // Set page title
        document.title = product.name + ' - CloudyBreeze';

        // Update SEO meta description
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && product.short_description) {
            metaDesc.setAttribute('content', product.short_description);
        }

        // Breadcrumb
        if (product.category) {
            if (breadcrumbCategory) {
                breadcrumbCategory.textContent = product.category.name;
                breadcrumbCategory.href = '/products?category=' + product.category.slug;
                breadcrumbCategory.style.display = 'inline';
            }
            if (breadcrumbCategorySep) breadcrumbCategorySep.style.display = 'inline';
            if (productCategoryTag) {
                productCategoryTag.textContent = product.category.name;
            }
        }
        if (breadcrumbCurrent) breadcrumbCurrent.textContent = product.name;

        // Gallery
        renderGallery();

        // Product name
        if (productName) productName.textContent = product.name;

        // Pricing
        renderPricing();

        // Short description
        if (productShortDesc) {
            productShortDesc.textContent = product.short_description || '';
        }

        // Variants
        renderVariants();

        // Quantity
        resetQuantity();

        // Add to cart button price
        updateAddToCartPrice();

        // Product meta
        renderMeta();

        // Full description
        if (product.description && productDescription && descriptionContent) {
            productDescription.style.display = 'block';
            descriptionContent.innerHTML = product.description;
        }
    }

    /**
     * Render product gallery with main image and thumbnails.
     */
    function renderGallery() {
        var images = product.images || [];
        var coverImage = product.cover_image;

        // Build image list: cover image first, then gallery images
        var allImages = [];
        if (coverImage) {
            allImages.push({ url: coverImage, isPrimary: true });
        }
        images.forEach(function (img) {
            // Avoid duplicating cover image
            if (img.image_url !== coverImage) {
                allImages.push({ url: img.image_url, isPrimary: img.is_primary });
            }
        });

        if (allImages.length === 0) {
            if (galleryMainImage) {
                galleryMainImage.src = '';
                galleryMainImage.alt = product.name + ' - No image available';
            }
            return;
        }

        // Set main image
        if (galleryMainImage) {
            galleryMainImage.src = allImages[0].url;
            galleryMainImage.alt = product.name;
        }

        // Render thumbnails
        if (galleryThumbnails) {
            galleryThumbnails.innerHTML = allImages.map(function (img, index) {
                return '<div class="gallery-thumbnail' + (index === 0 ? ' active' : '') + '" data-index="' + index + '">' +
                    '<img src="' + img.url + '" alt="' + product.name + ' - Image ' + (index + 1) + '" loading="lazy">' +
                '</div>';
            }).join('');

            // Add click handlers
            galleryThumbnails.querySelectorAll('.gallery-thumbnail').forEach(function (thumb) {
                thumb.addEventListener('click', function () {
                    var index = parseInt(this.getAttribute('data-index'));
                    if (galleryMainImage && allImages[index]) {
                        galleryMainImage.src = allImages[index].url;
                    }
                    // Update active state
                    galleryThumbnails.querySelectorAll('.gallery-thumbnail').forEach(function (t) {
                        t.classList.remove('active');
                    });
                    this.classList.add('active');
                });
            });
        }
    }

    /**
     * Render product pricing with discount badge.
     */
    function renderPricing() {
        var price = parseFloat(product.price);

        if (productPrice) {
            productPrice.textContent = '$' + price.toFixed(2);
        }

        // Compare price (original price for sale items)
        if (product.compare_price && parseFloat(product.compare_price) > price) {
            if (productComparePrice) {
                productComparePrice.textContent = '$' + parseFloat(product.compare_price).toFixed(2);
                productComparePrice.style.display = 'inline';
            }
            // Calculate discount percentage
            var discount = Math.round((1 - price / parseFloat(product.compare_price)) * 100);
            if (productDiscountBadge) {
                productDiscountBadge.textContent = '-' + discount + '%';
                productDiscountBadge.style.display = 'inline-block';
            }
        } else {
            if (productComparePrice) productComparePrice.style.display = 'none';
            if (productDiscountBadge) productDiscountBadge.style.display = 'none';
        }
    }

    /**
     * Render variant selection options.
     */
    function renderVariants() {
        var variants = product.variants || [];

        if (variants.length === 0) {
            if (productVariants) productVariants.style.display = 'none';
            selectedVariant = null;
            return;
        }

        if (productVariants) productVariants.style.display = 'block';

        if (variantsOptions) {
            variantsOptions.innerHTML = variants.map(function (variant) {
                return '<button class="variant-option" data-variant-id="' + variant.id + '">' +
                    variant.variation_name +
                '</button>';
            }).join('');

            // Add click handlers
            variantsOptions.querySelectorAll('.variant-option').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var variantId = this.getAttribute('data-variant-id');
                    var variant = variants.find(function (v) { return v.id === variantId; });

                    // Update active state
                    variantsOptions.querySelectorAll('.variant-option').forEach(function (b) {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');

                    // Update selected variant
                    selectedVariant = variant;

                    // Update pricing and add to cart button
                    updateAddToCartPrice();
                });
            });

            // Auto-select first variant
            var firstVariantBtn = variantsOptions.querySelector('.variant-option');
            if (firstVariantBtn) {
                firstVariantBtn.click();
            }
        }
    }

    /**
     * Update the add to cart button price display.
     */
    function updateAddToCartPrice() {
        var price = parseFloat(product.price);

        if (selectedVariant) {
            price += parseFloat(selectedVariant.price_adjustment || 0);
        }

        if (addToCartPrice) {
            addToCartPrice.textContent = '$' + (price * quantity).toFixed(2);
        }
    }

    /**
     * Render product meta information.
     */
    function renderMeta() {
        if (!productMeta) return;

        var html = '';

        if (product.category) {
            html += '<div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">' + product.category.name + '</span></div>';
        }

        if (selectedVariant && selectedVariant.sku) {
            html += '<div class="detail-row"><span class="detail-label">SKU</span><span class="detail-value">' + selectedVariant.sku + '</span></div>';
        }

        productMeta.innerHTML = html;
    }

    // ============================================================
    // Related Products
    // ============================================================

    /**
     * Load related products from the same category.
     */
    function loadRelatedProducts() {
        if (!product || !product.category || !relatedSection || !relatedProducts) return;

        fetch('/api/products/category/' + encodeURIComponent(product.category.slug) + '?limit=4')
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.data || result.data.length === 0) return;

                // Filter out the current product
                var related = result.data.filter(function (p) {
                    return p.id !== product.id;
                }).slice(0, 4);

                if (related.length === 0) return;

                relatedSection.style.display = 'block';

                relatedProducts.innerHTML = related.map(function (p) {
                    var coverImage = p.cover_image || (p.images && p.images.length > 0 ? p.images[0].image_url : '');
                    return '<div class="product-card">' +
                        '<a href="/products/' + p.slug + '" class="product-card-link">' +
                            '<div class="product-card-image">' +
                                (coverImage
                                    ? '<img src="' + coverImage + '" alt="' + p.name + '" loading="lazy">'
                                    : '<div class="product-card-placeholder">No Image</div>') +
                            '</div>' +
                            '<div class="product-card-body">' +
                                '<h3 class="product-card-title">' + p.name + '</h3>' +
                                '<div class="product-card-price">' +
                                    '<span class="product-price">$' + parseFloat(p.price).toFixed(2) + '</span>' +
                                '</div>' +
                            '</div>' +
                        '</a>' +
                    '</div>';
                }).join('');
            })
            .catch(function (err) {
                console.error('Error loading related products:', err);
            });
    }

    // ============================================================
    // Quantity Selector
    // ============================================================

    function initQuantitySelector() {
        var decreaseBtn = document.getElementById('quantityDecrease');
        var increaseBtn = document.getElementById('quantityIncrease');

        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', function () {
                if (quantity > 1) {
                    quantity--;
                    if (quantityInput) quantityInput.value = quantity;
                    updateAddToCartPrice();
                }
            });
        }

        if (increaseBtn) {
            increaseBtn.addEventListener('click', function () {
                if (quantity < 99) {
                    quantity++;
                    if (quantityInput) quantityInput.value = quantity;
                    updateAddToCartPrice();
                }
            });
        }

        if (quantityInput) {
            quantityInput.addEventListener('change', function () {
                var val = parseInt(this.value);
                if (isNaN(val) || val < 1) {
                    quantity = 1;
                } else if (val > 99) {
                    quantity = 99;
                } else {
                    quantity = val;
                }
                this.value = quantity;
                updateAddToCartPrice();
            });
        }
    }

    function resetQuantity() {
        quantity = 1;
        if (quantityInput) quantityInput.value = 1;
    }

    // ============================================================
    // Add to Cart
    // ============================================================

    function initAddToCart() {
        if (!addToCartBtn) return;

        addToCartBtn.addEventListener('click', function () {
            if (!product) return;

            // Add to cart using site.js function
            window.CloudyBreeze.addToCart(product, selectedVariant, quantity);

            // Show success message
            if (cartMessage) {
                cartMessage.textContent = 'Added to cart!';
                cartMessage.className = 'cart-message success';
                cartMessage.style.display = 'block';

                // Hide after 3 seconds
                setTimeout(function () {
                    cartMessage.style.display = 'none';
                }, 3000);
            }

            // Scroll to message
            if (cartMessage) {
                cartMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // ============================================================
    // UI State Management
    // ============================================================

    function showLoading() {
        if (productLoading) productLoading.style.display = 'block';
        if (productError) productError.style.display = 'none';
        if (productDetail) productDetail.style.display = 'none';
    }

    function hideLoading() {
        if (productLoading) productLoading.style.display = 'none';
    }

    function showError(message) {
        hideLoading();
        if (productError) productError.style.display = 'block';
        if (productErrorMessage) productErrorMessage.textContent = message || 'Product not found.';
        if (productDetail) productDetail.style.display = 'none';
    }

    // ============================================================
    // Initialization
    // ============================================================

    function init() {
        loadProduct();
        initQuantitySelector();
        initAddToCart();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();