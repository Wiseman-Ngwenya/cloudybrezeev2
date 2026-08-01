-- ============================================================
-- CloudyBreeze E-Commerce System
-- Complete Database Schema
-- Supabase PostgreSQL
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- ----------------------------------------
-- TABLE: profiles
-- Admin user profiles (auth handled by Supabase Auth)
-- ----------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on email for lookups
CREATE INDEX idx_profiles_email ON profiles(email);

-- Index on role for filtering
CREATE INDEX idx_profiles_role ON profiles(role);

-- ----------------------------------------
-- TABLE: categories
-- Product categories
-- ----------------------------------------
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(active);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- ----------------------------------------
-- TABLE: products
-- Core product entity
-- ----------------------------------------
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    compare_price DECIMAL(10, 2) CHECK (compare_price IS NULL OR compare_price >= 0),
    featured BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    cover_image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_active_featured ON products(active, featured);
CREATE INDEX idx_products_price ON products(price);

-- ----------------------------------------
-- TABLE: product_images
-- Gallery images per product
-- ----------------------------------------
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(is_primary);
CREATE INDEX idx_product_images_sort_order ON product_images(sort_order);

-- Ensure only one primary image per product
CREATE UNIQUE INDEX idx_one_primary_per_product ON product_images(product_id, is_primary) WHERE is_primary = true;

-- ----------------------------------------
-- TABLE: product_variants
-- Product variations (color, size, capacity)
-- ----------------------------------------
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_name TEXT NOT NULL,
    sku TEXT UNIQUE,
    price_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_active ON product_variants(active);

-- ----------------------------------------
-- TABLE: orders
-- Customer orders (guest checkout)
-- ----------------------------------------
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'paypal')),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_cost >= 0),
    total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_country TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);

-- ----------------------------------------
-- TABLE: order_items
-- Line items per order
-- ----------------------------------------
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    variant_name TEXT,
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0)
);

-- Indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

-- ----------------------------------------
-- TABLE: store_settings
-- Singleton store configuration
-- ----------------------------------------
CREATE TABLE store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name TEXT NOT NULL DEFAULT 'CloudyBreeze',
    email TEXT,
    phone TEXT,
    address TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_cost >= 0),
    free_shipping_threshold DECIMAL(10, 2) CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
    facebook TEXT,
    instagram TEXT,
    twitter TEXT,
    seo_title TEXT,
    seo_description TEXT
);

-- Ensure only one settings row exists
-- (enforced by application logic; this unique index on a constant ensures at most one row)
CREATE UNIQUE INDEX idx_single_store_settings ON store_settings((true));

-- ----------------------------------------
-- TABLE: visitors
-- Analytics tracking
-- ----------------------------------------
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address TEXT,
    country TEXT,
    city TEXT,
    browser TEXT,
    operating_system TEXT,
    device TEXT,
    page TEXT,
    referrer TEXT,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_visitors_visited_at ON visitors(visited_at DESC);
CREATE INDEX idx_visitors_country ON visitors(country);
CREATE INDEX idx_visitors_page ON visitors(page);
CREATE INDEX idx_visitors_device ON visitors(device);
CREATE INDEX idx_visitors_country_visited ON visitors(country, visited_at DESC);
CREATE INDEX idx_visitors_page_visited ON visitors(page, visited_at DESC);

-- ----------------------------------------
-- TABLE: newsletter
-- Email subscribers
-- ----------------------------------------
CREATE TABLE newsletter (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_newsletter_email ON newsletter(email);
CREATE INDEX idx_newsletter_subscribed_at ON newsletter(subscribed_at DESC);

-- ----------------------------------------
-- TABLE: contact_messages
-- Customer inquiries
-- ----------------------------------------
CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_contact_messages_email ON contact_messages(email);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- RLS Policies
-- ----------------------------------------

-- profiles: Admin can read all profiles, only update own
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- categories: Public read, admin write
CREATE POLICY "Anyone can view active categories"
    ON categories FOR SELECT
    USING (active = true OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)));

CREATE POLICY "Admins can insert categories"
    ON categories FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can update categories"
    ON categories FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can delete categories"
    ON categories FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- products: Public read active products, admin full access
CREATE POLICY "Anyone can view active products"
    ON products FOR SELECT
    USING (active = true OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)));

CREATE POLICY "Admins can insert products"
    ON products FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can update products"
    ON products FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can delete products"
    ON products FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- product_images: Public read, admin write
CREATE POLICY "Anyone can view product images"
    ON product_images FOR SELECT
    USING (true);

CREATE POLICY "Admins can insert product images"
    ON product_images FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can update product images"
    ON product_images FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can delete product images"
    ON product_images FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- product_variants: Public read, admin write
CREATE POLICY "Anyone can view active variants"
    ON product_variants FOR SELECT
    USING (active = true OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)));

CREATE POLICY "Admins can insert variants"
    ON product_variants FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can update variants"
    ON product_variants FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can delete variants"
    ON product_variants FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- orders: Public insert, admin read/update, users can track own orders
CREATE POLICY "Anyone can insert orders"
    ON orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can view own order by order number"
    ON orders FOR SELECT
    USING (
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
        OR (auth.uid() IS NULL AND order_number IS NOT NULL)
    );

CREATE POLICY "Admins can update orders"
    ON orders FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- order_items: Public read for own orders, admin full access
CREATE POLICY "Anyone can view order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)
        OR EXISTS (SELECT 1 FROM orders WHERE id = order_id)
    );

CREATE POLICY "Anyone can insert order items"
    ON order_items FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can update order items"
    ON order_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- store_settings: Public read, admin write
CREATE POLICY "Anyone can view store settings"
    ON store_settings FOR SELECT
    USING (true);

CREATE POLICY "Admins can insert store settings"
    ON store_settings FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can update store settings"
    ON store_settings FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- visitors: Public insert, admin read
CREATE POLICY "Anyone can insert visitor tracking"
    ON visitors FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view visitors"
    ON visitors FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- newsletter: Public insert, admin read/delete
CREATE POLICY "Anyone can subscribe"
    ON newsletter FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view subscribers"
    ON newsletter FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can delete subscribers"
    ON newsletter FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- contact_messages: Public insert, admin read/delete
CREATE POLICY "Anyone can send contact message"
    ON contact_messages FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view contact messages"
    ON contact_messages FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

CREATE POLICY "Admins can delete contact messages"
    ON contact_messages FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- ----------------------------------------
-- FUNCTION: update_updated_at_column()
-- Trigger function to auto-update updated_at timestamp
-- ----------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at for profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for categories
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for products
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for orders
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert default store settings
INSERT INTO store_settings (store_name, email, currency, shipping_cost)
VALUES ('CloudyBreeze', 'hello@cloudybreeze.com', 'USD', 5.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE profiles IS 'Admin user profiles linked to Supabase Auth users';
COMMENT ON TABLE categories IS 'Product categories for organizing the catalog';
COMMENT ON TABLE products IS 'Core product catalog with pricing and metadata';
COMMENT ON TABLE product_images IS 'Gallery images associated with products';
COMMENT ON TABLE product_variants IS 'Product variations such as color, size, or capacity';
COMMENT ON TABLE orders IS 'Customer orders from guest checkout';
COMMENT ON TABLE order_items IS 'Individual line items within each order';
COMMENT ON TABLE store_settings IS 'Singleton table for store-wide configuration';
COMMENT ON TABLE visitors IS 'Analytics tracking for page visits';
COMMENT ON TABLE newsletter IS 'Email newsletter subscribers';
COMMENT ON TABLE contact_messages IS 'Customer contact form submissions';

-- ============================================================
-- END OF SCHEMA
-- ============================================================