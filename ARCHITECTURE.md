# CloudyBreeze E-Commerce System – Architecture

## 1. SYSTEM OVERVIEW

CloudyBreeze is a server-rendered e-commerce platform specializing in humidifiers and aroma diffusers. The system follows a strict three-tier architecture where the backend serves as the exclusive intermediary between the frontend and Supabase services.

### Core Principles
- **Backend as Single Source of Truth**: All database and storage operations flow through Express API
- **Supabase Auth for Admin**: Managed authentication with zero custom password handling
- **Guest-Only Frontend**: No customer accounts, order tracking via order number
- **Database-Driven Content**: Zero hardcoded products, categories, or images
- **Modular Payment Layer**: Gateway-agnostic design for future expansion

---

## 2. TECHNOLOGY STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20 LTS | Server environment |
| Framework | Express.js | 4.18+ | REST API server |
| Database | Supabase PostgreSQL | Latest | Primary data store |
| Storage | Supabase Storage | Latest | Image/file storage |
| Auth | Supabase Auth | Latest | Admin authentication |
| Client DB | @supabase/supabase-js | 2.x | Backend DB/Storage client |
| Auth Middleware | supabase-js auth helpers | Built-in | JWT verification |
| Session | express-session | Latest | Flash messages (optional) |
| File Upload | multer | Latest | Temp file handling |
| Security | helmet, cors, express-rate-limit | Latest | API protection |
| Validation | express-validator | Latest | Input sanitization |
| Logging | morgan | Latest | HTTP request logging |
| Frontend | HTML5, CSS3, Vanilla JS | - | No frameworks |

---

## 3. DATABASE ARCHITECTURE

### 3.1 Schema Design

**profiles**
- Managed by Supabase Auth (`auth.users`)
- Stores admin metadata
- Primary key `id` references `auth.users.id`
- Fields: id(UUID PK), email, full_name, role('admin'), active(boolean), created_at, updated_at

**categories**
- Product categorization
- Slug-based URL routing
- Sortable display order
- Fields: id(UUID PK), name, slug(UNIQUE), description, image_url, active, sort_order, created_at, updated_at

**products**
- Core product entity
- Optional category assignment
- Dual pricing (price + compare_price for sales)
- Featured flag for homepage
- Fields: id(UUID PK), category_id(FK→categories.id SET NULL), name, slug(UNIQUE), short_description, description, price(DECIMAL 10,2), compare_price(DECIMAL 10,2 NULL), featured(boolean), active(boolean), cover_image, created_at, updated_at

**product_images**
- Gallery images per product
- Primary flag for main display
- Fields: id(UUID PK), product_id(FK→products.id CASCADE), image_url, is_primary(boolean), sort_order, created_at

**product_variants**
- Product variations (color, size, capacity)
- Independent pricing via price_adjustment
- Fields: id(UUID PK), product_id(FK→products.id CASCADE), variation_name, sku(UNIQUE), price_adjustment(DECIMAL 10,2 DEFAULT 0), image_url, active(boolean), created_at

**orders**
- Guest checkout orders
- Order number format: CB-YYYYNNNNNN
- Full shipping details captured
- Fields: id(UUID PK), order_number(UNIQUE), status('pending','confirmed','processing','shipped','delivered','cancelled'), payment_status('pending','paid','failed','refunded'), payment_method('bank_transfer','paypal'), subtotal(DECIMAL 10,2), shipping_cost(DECIMAL 10,2), total(DECIMAL 10,2), customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_country, notes, created_at, updated_at

**order_items**
- Line items per order
- Snapshot product/variant names (not FK-dependent for historical accuracy)
- Fields: id(UUID PK), order_id(FK→orders.id CASCADE), product_id(FK→products.id SET NULL), variant_id(FK→product_variants.id SET NULL), product_name, variant_name, unit_price(DECIMAL 10,2), quantity(INT), line_total(DECIMAL 10,2)

**store_settings**
- Singleton configuration (single row expected)
- Fields: id(UUID PK), store_name, email, phone, address, currency(DEFAULT 'USD'), shipping_cost(DECIMAL 10,2 DEFAULT 0), free_shipping_threshold(DECIMAL 10,2 NULL), facebook, instagram, twitter, seo_title, seo_description

**visitors**
- Analytics tracking
- Fields: id(UUID PK), ip_address, country, city, browser, operating_system, device, page, referrer, visited_at(TIMESTAMPTZ DEFAULT NOW())

**newsletter**
- Email subscriptions
- Fields: id(UUID PK), email(UNIQUE), subscribed_at(TIMESTAMPTZ DEFAULT NOW())

**contact_messages**
- Customer inquiries
- Fields: id(UUID PK), name, email, subject, message, created_at(TIMESTAMPTZ DEFAULT NOW())

### 3.2 Indexes
- products: category_id, slug, active, featured
- orders: order_number, customer_email, status, created_at
- visitors: visited_at, country, page
- product_images: product_id
- product_variants: product_id, sku
- order_items: order_id

### 3.3 Relationships
- products.category_id → categories.id (SET NULL on delete)
- product_images.product_id → products.id (CASCADE delete)
- product_variants.product_id → products.id (CASCADE delete)
- orders.id → order_items.order_id (CASCADE delete)
- order_items.product_id → products.id (SET NULL on delete)
- order_items.variant_id → product_variants.id (SET NULL on delete)

---

## 4. API ARCHITECTURE

### 4.1 Base URL