// ============================================================
// CloudyBreeze E-Commerce System
// Product Catalog JavaScript
// ============================================================
// Handles product listing page functionality:
// - Load products with filtering and pagination
// - Category filter sidebar
// - Search and sort controls
// - Dynamic URL parameter management
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // State
    // ============================================================
    var currentPage = 1;
    var currentCategory = '';
    var currentSearch = '';
    var currentSort = 'created_at';
    var currentOrder = 'desc';
    var totalPages = 1;

    // ============================================================
    // DOM Elements
    // ============================================================
    var productsGrid = document.getElementById('productsGrid');
    var catalogLoading = document.getElementById('catalogLoading');
    var catalogEmpty = document.getElementById('catalogEmpty');
    var catalogEmptyMessage = document.getElementById('catalogEmptyMessage');
    var resultCount = document.getElementById('resultCount');
    var pagination = document.getElementById('pagination');
    var searchInput = document.getElementById('searchInput');
    var sortSelect = document.getElementById('sortSelect');
    var categoryFilters = document.getElementById('categoryFilters');
    var categoryFilterLoading = document.getElementById('categoryFilterLoading');
    var clearFiltersBtn = document.getElementById('clearFilters');
    var filterPanel = document.getElementById('filterPanel');
    var filterToggle = document.getElementById('filterToggle');
    var catalogInfo = document.getElementById('catalogInfo');

    // ============================================================
    // URL Parameter Management
    // ============================================================

    /**
     * Read filter state from URL query parameters.
     */
    function readUrlParams() {
        var params = new URLSearchParams(window.location.search);
        currentPage = parseInt(params.get('page')) || 1;
        currentCategory = params.get('category') || '';
        currentSearch = params.get('search') || '';
        currentSort = params.get('sort') || 'created_at';
        currentOrder = params.get('order') || 'desc';

        // Update UI to match URL params
        if (searchInput) searchInput.value = currentSearch;
        if (sortSelect) sortSelect.value = currentSort + '-' + currentOrder;
    }

    /**
     * Update URL query parameters without reloading the page.
     */
    function updateUrlParams() {
        var params = new URLSearchParams();

        if (currentPage > 1) params.set('page', currentPage);
        if (currentCategory) params.set('category', currentCategory);
        if (currentSearch) params.set('search', currentSearch);
        if (currentSort !== 'created_at') params.set('sort', currentSort);
        if (currentOrder !== 'desc') params.set('order', currentOrder);

        var queryString = params.toString();
        var newUrl = window.location.pathname + (queryString ? '?' + queryString : '');

        if (window.location.search !== (queryString ? '?' + queryString : '')) {
            history.pushState(null, '', newUrl);
        }
    }

    // ============================================================
    // Load Categories (Sidebar)
    // ============================================================

    /**
     * Load categories for the filter sidebar.
     */
    function loadCategories() {
        if (!categoryFilters || !categoryFilterLoading) return;

        fetch('/api/categories')
            .then(function (res) { return res.json(); })
            .then(function (result) {
                categoryFilterLoading.style.display = 'none';

                if (!result.success || !result.data || result.data.length === 0) {
                    return;
                }

                var categories = result.data;
                var html = '<button class="filter-option' + (currentCategory === '' ? ' active' : '') + '" data-category="">All Products</button>';

                categories.forEach(function (category) {
                    var isActive = currentCategory === category.slug;
                    html += '<button class="filter-option' + (isActive ? ' active' : '') + '" data-category="' + category.slug + '">' + category.name + '</button>';
                });

                categoryFilters.innerHTML = html;

                // Add click handlers
                categoryFilters.querySelectorAll('.filter-option').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var category = this.getAttribute('data-category');
                        currentCategory = category;
                        currentPage = 1;
                        updateUrlParams();
                        loadProducts();
                        updateActiveCategoryFilter();
                    });
                });
            })
            .catch(function (err) {
                console.error('Error loading categories:', err);
                categoryFilterLoading.style.display = 'none';
            });
    }

    /**
     * Update active state on category filter buttons.
     */
    function updateActiveCategoryFilter() {
        if (!categoryFilters) return;

        categoryFilters.querySelectorAll('.filter-option').forEach(function (btn) {
            var category = btn.getAttribute('data-category');
            if (category === currentCategory) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // ============================================================
    // Load Products
    // ============================================================

    /**
     * Fetch and display products based on current filter state.
     */
    function loadProducts() {
        if (!productsGrid) return;

        // Show loading
        showLoading();

        // Build API URL with query parameters
        var params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('limit', 12);
        if (currentCategory) params.set('category', currentCategory);
        if (currentSearch) params.set('search', currentSearch);
        params.set('sort', currentSort);
        params.set('order', currentOrder);

        fetch('/api/products?' + params.toString())
            .then(function (res) { return res.json(); })
            .then(function (result) {
                hideLoading();

                if (!result.success) {
                    showError('Failed to load products.');
                    return;
                }

                var products = result.data || [];
                var count = result.count || 0;
                var paginationData = result.pagination || {};

                // Update result count
                if (resultCount) {
                    resultCount.textContent = count;
                }

                // Update total pages
                totalPages = paginationData.pages || 1;

                // Handle empty state
                if (products.length === 0) {
                    showEmpty(currentSearch ? 'No products match your search.' : 'No products found in this category.');
                    return;
                }

                // Hide empty state
                hideEmpty();

                // Render products
                renderProducts(products);

                // Render pagination
                renderPagination(paginationData);
            })
            .catch(function (err) {
                console.error('Error loading products:', err);
                hideLoading();
                showError('Unable to load products. Please try again later.');
            });
    }

    /**
     * Render product cards into the grid.
     *
     * @param {Array} products - Array of product objects
     */
    function renderProducts(products) {
        if (!productsGrid) return;

        productsGrid.innerHTML = products.map(function (product) {
            var coverImage = product.cover_image || (product.images && product.images.length > 0 ? product.images[0].image_url : '');
            var comparePriceHtml = '';
            if (product.compare_price) {
                comparePriceHtml = '<span class="product-compare-price">$' + parseFloat(product.compare_price).toFixed(2) + '</span>';
            }

            return '<div class="product-card">' +
                '<a href="/products/' + product.slug + '" class="product-card-link">' +
                    '<div class="product-card-image">' +
                        (coverImage
                            ? '<img src="' + coverImage + '" alt="' + product.name + '" loading="lazy">'
                            : '<div class="product-card-placeholder">No Image</div>') +
                    '</div>' +
                    '<div class="product-card-body">' +
                        '<span class="product-card-category">' + (product.category ? product.category.name : '') + '</span>' +
                        '<h3 class="product-card-title">' + product.name + '</h3>' +
                        '<div class="product-card-price">' +
                            '<span class="product-price">$' + parseFloat(product.price).toFixed(2) + '</span>' +
                            comparePriceHtml +
                        '</div>' +
                    '</div>' +
                '</a>' +
            '</div>';
        }).join('');
    }

    /**
     * Render pagination buttons.
     *
     * @param {Object} paginationData - Pagination metadata from API
     */
    function renderPagination(paginationData) {
        if (!pagination) return;

        var page = paginationData.page || currentPage;
        var pages = paginationData.pages || 1;

        if (pages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        var html = '';

        // Previous button
        html += '<button class="pagination-btn" ' + (page <= 1 ? 'disabled' : '') + ' data-page="' + (page - 1) + '" aria-label="Previous page">&laquo;</button>';

        // Page numbers
        var startPage = Math.max(1, page - 2);
        var endPage = Math.min(pages, page + 2);

        if (startPage > 1) {
            html += '<button class="pagination-btn" data-page="1">1</button>';
            if (startPage > 2) {
                html += '<span class="pagination-btn" style="border:none;cursor:default;">...</span>';
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            html += '<button class="pagination-btn' + (i === page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }

        if (endPage < pages) {
            if (endPage < pages - 1) {
                html += '<span class="pagination-btn" style="border:none;cursor:default;">...</span>';
            }
            html += '<button class="pagination-btn" data-page="' + pages + '">' + pages + '</button>';
        }

        // Next button
        html += '<button class="pagination-btn" ' + (page >= pages ? 'disabled' : '') + ' data-page="' + (page + 1) + '" aria-label="Next page">&raquo;</button>';

        pagination.innerHTML = html;

        // Add click handlers
        pagination.querySelectorAll('.pagination-btn[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var newPage = parseInt(this.getAttribute('data-page'));
                if (newPage !== currentPage) {
                    currentPage = newPage;
                    updateUrlParams();
                    loadProducts();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    // ============================================================
    // UI State Management
    // ============================================================

    function showLoading() {
        if (catalogLoading) catalogLoading.style.display = 'block';
        if (productsGrid) productsGrid.innerHTML = '';
        if (pagination) pagination.innerHTML = '';
        hideEmpty();
    }

    function hideLoading() {
        if (catalogLoading) catalogLoading.style.display = 'none';
    }

    function showEmpty(message) {
        hideLoading();
        if (catalogEmpty) catalogEmpty.style.display = 'block';
        if (catalogEmptyMessage) catalogEmptyMessage.textContent = message || 'No products found.';
        if (productsGrid) productsGrid.innerHTML = '';
        if (pagination) pagination.innerHTML = '';
    }

    function hideEmpty() {
        if (catalogEmpty) catalogEmpty.style.display = 'none';
    }

    function showError(message) {
        showEmpty(message);
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    /**
     * Handle search input with debounce.
     */
    function initSearch() {
        if (!searchInput) return;

        var debounceTimer;

        searchInput.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                currentSearch = searchInput.value.trim();
                currentPage = 1;
                updateUrlParams();
                loadProducts();
            }, 400);
        });
    }

    /**
     * Handle sort select change.
     */
    function initSort() {
        if (!sortSelect) return;

        sortSelect.addEventListener('change', function () {
            var value = this.value;
            var parts = value.split('-');
            currentSort = parts[0] || 'created_at';
            currentOrder = parts[1] || 'desc';
            currentPage = 1;
            updateUrlParams();
            loadProducts();
        });
    }

    /**
     * Handle clear filters button.
     */
    function initClearFilters() {
        if (!clearFiltersBtn) return;

        clearFiltersBtn.addEventListener('click', function () {
            currentCategory = '';
            currentSearch = '';
            currentSort = 'created_at';
            currentOrder = 'desc';
            currentPage = 1;

            if (searchInput) searchInput.value = '';
            if (sortSelect) sortSelect.value = 'created_at-desc';

            updateUrlParams();
            loadProducts();
            updateActiveCategoryFilter();
        });
    }

    /**
     * Handle mobile filter toggle.
     */
    function initFilterToggle() {
        if (!filterToggle || !filterPanel) return;

        filterToggle.addEventListener('click', function () {
            var isOpen = filterPanel.classList.toggle('open');
            filterToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close filters when clicking outside
        document.addEventListener('click', function (e) {
            if (!filterPanel || !filterToggle) return;
            if (!filterPanel.contains(e.target) && !filterToggle.contains(e.target)) {
                filterPanel.classList.remove('open');
                filterToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ============================================================
    // Initialization
    // ============================================================

    function init() {
        readUrlParams();
        loadCategories();
        loadProducts();
        initSearch();
        initSort();
        initClearFilters();
        initFilterToggle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();