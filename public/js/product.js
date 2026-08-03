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
// - Buy now
// - Related products
// ============================================================

(function () {
    'use strict';

    var product = null;
    var selectedVariant = null;
    var quantity = 1;
    var isBuyingNow = false;

    var productLoading = document.getElementById('productLoading');
    var productError = document.getElementById('productError');
    var productErrorMessage = document.getElementById('productErrorMessage');
    var productDetail = document.getElementById('productDetail');

    var galleryMainImage = document.getElementById('galleryMainImage');
    var galleryEmpty = document.getElementById('galleryEmpty');
    var galleryThumbnails = document.getElementById('galleryThumbnails');
    var productAvailabilityBadge = document.getElementById('productAvailabilityBadge');
    var productGalleryCount = document.getElementById('productGalleryCount');
    var productCategoryTag = document.getElementById('productCategoryTag');
    var productSkuChip = document.getElementById('productSkuChip');
    var productName = document.getElementById('productName');
    var productPrice = document.getElementById('productPrice');
    var productComparePrice = document.getElementById('productComparePrice');
    var productDiscountBadge = document.getElementById('productDiscountBadge');
    var productShortDesc = document.getElementById('productShortDesc');
    var productVariants = document.getElementById('productVariants');
    var variantsOptions = document.getElementById('variantsOptions');
    var quantityInput = document.getElementById('quantityInput');
    var quantityDecrease = document.getElementById('quantityDecrease');
    var quantityIncrease = document.getElementById('quantityIncrease');
    var addToCartBtn = document.getElementById('addToCartBtn');
    var buyNowBtn = document.getElementById('buyNowBtn');
    var addToCartPrice = document.getElementById('addToCartPrice');
    var cartMessage = document.getElementById('cartMessage');
    var productMeta = document.getElementById('productMeta');
    var productDescription = document.getElementById('productDescription');
    var descriptionContent = document.getElementById('descriptionContent');
    var relatedSection = document.getElementById('relatedSection');
    var relatedProducts = document.getElementById('relatedProducts');
    var breadcrumbCategory = document.getElementById('breadcrumbCategory');
    var breadcrumbCategorySep = document.getElementById('breadcrumbCategorySep');
    var breadcrumbCurrent = document.getElementById('breadcrumbCurrent');

    function getSlugFromUrl() {
        var path = window.location.pathname.replace(/\/+$/, '');
        var parts = path.split('/');
        return parts[parts.length - 1];
    }

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
                scheduleRelatedProducts();
            })
            .catch(function (err) {
                console.error('Error loading product:', err);
                showError('Unable to load product details. Please try again later.');
            });
    }

    function setAvailabilityBadge() {
        if (!productAvailabilityBadge) return;

        if (product && product.active !== false) {
            productAvailabilityBadge.textContent = 'Available now';
        } else {
            productAvailabilityBadge.textContent = 'Currently unavailable';
        }
    }

    function renderProduct() {
        if (!product) return;

        if (productDetail) productDetail.style.display = 'block';
        document.title = product.name + ' - CloudyBreeze';

        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && product.short_description) {
            metaDesc.setAttribute('content', product.short_description);
        }

        if (product.category) {
            if (breadcrumbCategory) {
                breadcrumbCategory.textContent = product.category.name;
                breadcrumbCategory.href = '/products?category=' + product.category.slug;
                breadcrumbCategory.style.display = 'inline';
            }
            if (breadcrumbCategorySep) breadcrumbCategorySep.style.display = 'inline';
            if (productCategoryTag) productCategoryTag.textContent = product.category.name;
        }

        if (breadcrumbCurrent) breadcrumbCurrent.textContent = product.name;
        if (productName) productName.textContent = product.name;
        if (productShortDesc) productShortDesc.textContent = product.short_description || '';

        renderGallery();
        renderPricing();
        renderVariants();
        resetQuantity();
        updateAddToCartPrice();
        renderMeta();
        setAvailabilityBadge();

        if (product.description && productDescription && descriptionContent) {
            productDescription.style.display = 'block';
            descriptionContent.innerHTML = product.description;
        }
    }

    function renderGallery() {
        var images = product.images || [];
        var coverImage = product.cover_image;
        var allImages = [];

        if (coverImage) {
            allImages.push({ url: coverImage, isPrimary: true });
        }

        images.forEach(function (img) {
            if (img.image_url && img.image_url !== coverImage) {
                allImages.push({ url: img.image_url, isPrimary: img.is_primary });
            }
        });

        if (productGalleryCount) {
            productGalleryCount.textContent = allImages.length + (allImages.length === 1 ? ' image' : ' images');
        }

        if (!galleryMainImage || !galleryThumbnails || !galleryEmpty) return;

        if (allImages.length === 0) {
            galleryMainImage.removeAttribute('src');
            galleryMainImage.alt = product.name + ' - No image available';
            galleryEmpty.style.display = 'grid';
            galleryThumbnails.innerHTML = '';
            return;
        }

        galleryEmpty.style.display = 'none';
        galleryMainImage.style.opacity = '1';
        galleryMainImage.style.transition = 'opacity 180ms ease';
        galleryMainImage.src = allImages[0].url;
        galleryMainImage.alt = product.name;

        galleryThumbnails.innerHTML = allImages.map(function (img, index) {
            return '<button type="button" class="gallery-thumbnail' + (index === 0 ? ' active' : '') + '" data-index="' + index + '">' +
                '<img src="' + img.url + '" alt="' + product.name + ' - Image ' + (index + 1) + '" loading="lazy">' +
            '</button>';
        }).join('');

        function showImageAt(index) {
            if (!allImages[index] || !galleryMainImage) return;

            galleryMainImage.style.opacity = '0.25';
            window.setTimeout(function () {
                galleryMainImage.src = allImages[index].url;
                galleryMainImage.onload = function () {
                    galleryMainImage.style.opacity = '1';
                    galleryMainImage.onload = null;
                };
            }, 120);
        }

        galleryThumbnails.querySelectorAll('.gallery-thumbnail').forEach(function (thumb) {
            thumb.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-index'), 10);
                showImageAt(index);

                galleryThumbnails.querySelectorAll('.gallery-thumbnail').forEach(function (t) {
                    t.classList.remove('active');
                });
                this.classList.add('active');
            });
        });
    }

    function renderPricing() {
        var price = parseFloat(product.price) || 0;

        if (productPrice) {
            productPrice.textContent = '$' + price.toFixed(2);
        }

        if (product.compare_price && parseFloat(product.compare_price) > price) {
            if (productComparePrice) {
                productComparePrice.textContent = '$' + parseFloat(product.compare_price).toFixed(2);
                productComparePrice.style.display = 'inline';
            }

            var discount = Math.round((1 - price / parseFloat(product.compare_price)) * 100);
            if (productDiscountBadge) {
                productDiscountBadge.textContent = '-' + discount + '%';
                productDiscountBadge.style.display = 'inline-flex';
            }
        } else {
            if (productComparePrice) productComparePrice.style.display = 'none';
            if (productDiscountBadge) productDiscountBadge.style.display = 'none';
        }
    }

    function renderVariants() {
        var variants = product.variants || [];

        if (!productVariants || !variantsOptions) return;

        if (variants.length === 0) {
            productVariants.style.display = 'none';
            selectedVariant = null;
            if (productSkuChip) productSkuChip.textContent = 'SKU';
            return;
        }

        productVariants.style.display = 'block';

        variantsOptions.innerHTML = variants.map(function (variant) {
            return '<button type="button" class="variant-option" data-variant-id="' + variant.id + '">' +
                variant.variation_name +
            '</button>';
        }).join('');

        variantsOptions.querySelectorAll('.variant-option').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var variantId = this.getAttribute('data-variant-id');
                selectedVariant = variants.find(function (v) { return v.id === variantId; }) || null;

                variantsOptions.querySelectorAll('.variant-option').forEach(function (b) {
                    b.classList.remove('active');
                });
                this.classList.add('active');

                renderMeta();
                updateAddToCartPrice();
            });
        });

        var first = variantsOptions.querySelector('.variant-option');
        if (first) first.click();
    }

    function updateAddToCartPrice() {
        var price = parseFloat(product.price) || 0;
        if (selectedVariant) {
            price += parseFloat(selectedVariant.price_adjustment || 0);
        }
        if (addToCartPrice) addToCartPrice.textContent = '$' + (price * quantity).toFixed(2);
    }

    function renderMeta() {
        if (!productMeta) return;

        var html = '';
        if (product.category) {
            html += '<div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">' + product.category.name + '</span></div>';
        }
        if (selectedVariant && selectedVariant.sku) {
            html += '<div class="detail-row"><span class="detail-label">SKU</span><span class="detail-value">' + selectedVariant.sku + '</span></div>';
            if (productSkuChip) productSkuChip.textContent = 'SKU: ' + selectedVariant.sku;
        } else if (productSkuChip) {
            productSkuChip.textContent = 'SKU';
        }
        productMeta.innerHTML = html;
    }

    function scheduleRelatedProducts() {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(loadRelatedProducts, { timeout: 1200 });
        } else {
            setTimeout(loadRelatedProducts, 0);
        }
    }

    function loadRelatedProducts() {
        if (!product || !product.category || !relatedSection || !relatedProducts) return;

        fetch('/api/products/category/' + encodeURIComponent(product.category.slug) + '?limit=4')
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.data || result.data.length === 0) return;

                var related = result.data.filter(function (p) {
                    return p.id !== product.id;
                }).slice(0, 4);

                if (related.length === 0) return;

                relatedSection.style.display = 'block';

                relatedProducts.innerHTML = related.map(function (p) {
                    var coverImage = p.cover_image || (p.images && p.images.length > 0 ? p.images[0].image_url : '');
                    return '<article class="related-card">' +
                        '<a href="/products/' + p.slug + '">' +
                            '<div class="related-card-image">' +
                                (coverImage
                                    ? '<img src="' + coverImage + '" alt="' + p.name + '" loading="lazy">'
                                    : '<div class="pd-gallery-empty" style="min-height:0;padding:24px;">No Image</div>') +
                            '</div>' +
                            '<div class="related-card-body">' +
                                '<h3 class="related-card-title">' + p.name + '</h3>' +
                                '<div class="related-card-price">$' + parseFloat(p.price).toFixed(2) + '</div>' +
                            '</div>' +
                        '</a>' +
                    '</article>';
                }).join('');
            })
            .catch(function (err) {
                console.error('Error loading related products:', err);
            });
    }

    function initQuantitySelector() {
        if (quantityDecrease) {
            quantityDecrease.addEventListener('click', function () {
                if (quantity > 1) {
                    quantity -= 1;
                    if (quantityInput) quantityInput.value = quantity;
                    updateAddToCartPrice();
                }
            });
        }

        if (quantityIncrease) {
            quantityIncrease.addEventListener('click', function () {
                if (quantity < 99) {
                    quantity += 1;
                    if (quantityInput) quantityInput.value = quantity;
                    updateAddToCartPrice();
                }
            });
        }

        if (quantityInput) {
            quantityInput.addEventListener('change', function () {
                var val = parseInt(this.value, 10);
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

    function getCartApi() {
        return window.CloudyBreeze || {};
    }

    function addCurrentProductToCart() {
        var api = getCartApi();

        if (typeof api.addToCart !== 'function') {
            console.error('Cart helper not available. site.js must be loaded before product.js');
            return false;
        }

        api.addToCart(product, selectedVariant, quantity);

        if (typeof api.updateCartCount === 'function') {
            api.updateCartCount();
        }

        return true;
    }

    function setActionButtonsDisabled(disabled) {
        if (addToCartBtn) addToCartBtn.disabled = disabled;
        if (buyNowBtn) buyNowBtn.disabled = disabled;
    }

    function initAddToCart() {
        if (!addToCartBtn) return;

        addToCartBtn.addEventListener('click', function () {
            if (!product) return;
            if (!addCurrentProductToCart()) return;

            if (cartMessage) {
                cartMessage.textContent = 'Added to cart!';
                cartMessage.className = 'cart-message success';
                cartMessage.style.display = 'block';
                setTimeout(function () { cartMessage.style.display = 'none'; }, 2200);
                cartMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    function initBuyNow() {
        if (!buyNowBtn) return;

        buyNowBtn.addEventListener('click', function () {
            if (!product || isBuyingNow) return;

            isBuyingNow = true;
            setActionButtonsDisabled(true);
            buyNowBtn.textContent = 'Adding to cart...';

            var added = addCurrentProductToCart();
            if (!added) {
                isBuyingNow = false;
                setActionButtonsDisabled(false);
                buyNowBtn.textContent = 'Buy Now';
                return;
            }

            buyNowBtn.textContent = 'Redirecting...';
            window.setTimeout(function () {
                window.location.href = '/checkout';
            }, 150);
        });
    }

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

    function resetQuantity() {
        quantity = 1;
        if (quantityInput) quantityInput.value = 1;
    }

    function init() {
        loadProduct();
        initQuantitySelector();
        initAddToCart();
        initBuyNow();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();