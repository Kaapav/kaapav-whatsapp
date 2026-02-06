-- ────────────────────────────────────────────────────────────────
-- USERS (Dashboard Users)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    avatar TEXT,
    is_active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- SESSIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

-- ────────────────────────────────────────────────────────────────
-- CUSTOMERS (WhatsApp Users)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    
    -- Address
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    
    -- Segmentation
    segment TEXT DEFAULT 'new',
    tier TEXT DEFAULT 'bronze',
    labels TEXT DEFAULT '[]',
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    
    -- Cart
    cart TEXT DEFAULT '[]',
    cart_updated_at TEXT,
    
    -- Preferences
    language TEXT DEFAULT 'en',
    opted_in INTEGER DEFAULT 1,
    
    -- Tracking
    first_seen TEXT,
    last_seen TEXT,
    last_order_at TEXT,
    
    -- Push
    push_subscription TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ────────────────────────────────────────────────────────────────
-- CHATS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    
    -- Last message
    last_message TEXT,
    last_message_type TEXT DEFAULT 'text',
    last_timestamp TEXT,
    last_direction TEXT,
    
    -- Counts
    unread_count INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    
    -- Assignment
    assigned_to TEXT,
    
    -- Status
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    labels TEXT DEFAULT '[]',
    
    -- Flags
    is_starred INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    is_bot_enabled INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT   
);

-- ────────────────────────────────────────────────────────────────
-- MESSAGES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE,
    phone TEXT NOT NULL,
    
    -- Content
    text TEXT,
    message_type TEXT DEFAULT 'text',
    direction TEXT NOT NULL,
    
    -- Media
    media_id TEXT,
    media_url TEXT,
    media_mime TEXT,
    media_caption TEXT,
    
    -- Interactive
    button_id TEXT,
    button_text TEXT,
    buttons TEXT,
    is_menu INTEGER DEFAULT 0,
    list_id TEXT,
    list_title TEXT,
    
    -- Context
    context_message_id TEXT,
    is_forwarded INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'sent',
    is_auto_reply INTEGER DEFAULT 0,
    is_template INTEGER DEFAULT 0,
    template_name TEXT,
    
    -- Timestamps
    timestamp TEXT NOT NULL,
    delivered_at TEXT,
    read_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP 
);

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Pricing
    price REAL NOT NULL,
    compare_price REAL,
    cost_price REAL,
    
    -- Category
    category TEXT,
    subcategory TEXT,
    tags TEXT DEFAULT '[]',
    
    -- Inventory
    stock INTEGER DEFAULT 0,
    track_inventory INTEGER DEFAULT 1,
    
    -- Media
    image_url TEXT,
    images TEXT DEFAULT '[]',
    video_url TEXT,
    
    -- Variants
    has_variants INTEGER DEFAULT 0,
    variants TEXT DEFAULT '[]',
    
    -- WhatsApp Catalog
    wa_product_id TEXT,
    
    -- Stats
    view_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ────────────────────────────────────────────────────────────────
-- ORDERS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    customer_name TEXT,
    
    -- Items
    items TEXT NOT NULL,
    item_count INTEGER DEFAULT 1,
    
    -- Pricing
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    discount_code TEXT,
    shipping_cost REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    
    -- Shipping Address
    shipping_name TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    
    -- Payment
    payment_method TEXT,
    payment_id TEXT,
    payment_link TEXT,
    payment_link_expires TEXT,
    paid_at TEXT,
    
    -- Shipping
    courier TEXT,
    tracking_id TEXT,
    tracking_url TEXT,
    shipment_id TEXT,
    awb_number TEXT,
    
    -- Dates
    confirmed_at TEXT,
    shipped_at TEXT,
    delivered_at TEXT,
    cancelled_at TEXT,
    
    -- Notes
    customer_notes TEXT,
    internal_notes TEXT,
    cancellation_reason TEXT,
    
    -- Source
    source TEXT DEFAULT 'whatsapp',
    
    -- Notifications sent
    confirmation_sent INTEGER DEFAULT 0,
    shipping_sent INTEGER DEFAULT 0,
    delivery_sent INTEGER DEFAULT 0,
    review_sent INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
    );

-- ────────────────────────────────────────────────────────────────
-- PAYMENTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    order_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    
    -- Gateway
    gateway TEXT DEFAULT 'razorpay',
    gateway_payment_id TEXT,
    gateway_order_id TEXT,
    gateway_signature TEXT,
    
    -- Amount
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    
    -- Status
    status TEXT DEFAULT 'pending',
    method TEXT,
    
    -- Timestamps
    paid_at TEXT,
    failed_at TEXT,
    
    -- Refund
    refund_amount REAL DEFAULT 0,
    refund_id TEXT,
    refunded_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
    
    
);

-- ────────────────────────────────────────────────────────────────
-- QUICK REPLIES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shortcut TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Type
    message_type TEXT DEFAULT 'text',
    buttons TEXT,
    list_data TEXT,
    media_url TEXT,
    
    -- Category
    category TEXT DEFAULT 'general',
    
    -- Variables
    variables TEXT DEFAULT '[]',
    
    -- Stats
    use_count INTEGER DEFAULT 0,
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- TEMPLATES (WhatsApp Approved)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    
    -- WhatsApp
    wa_template_id TEXT,
    wa_status TEXT DEFAULT 'pending',
    
    -- Content
    category TEXT,
    language TEXT DEFAULT 'en',
    header_type TEXT,
    header_text TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons TEXT,
    
    -- Variables
    variables TEXT DEFAULT '[]',
    
    -- Stats
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- BROADCASTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    
    -- Message
    message_type TEXT DEFAULT 'text',
    message TEXT,
    template_name TEXT,
    template_params TEXT,
    media_url TEXT,
    buttons TEXT,
    
    -- Targeting
    target_type TEXT DEFAULT 'all',
    target_labels TEXT,
    target_segment TEXT,
    target_filters TEXT,
    
    -- Counts
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'draft',
    
    -- Schedule
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    
    -- Rate limiting
    send_rate INTEGER DEFAULT 30,
    
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- BROADCAST RECIPIENTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    
    status TEXT DEFAULT 'pending',
    message_id TEXT,
    
    sent_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    clicked_at TEXT,
    failed_at TEXT,
    
    error_message TEXT,
    
    UNIQUE(broadcast_id, phone)
    );

-- ────────────────────────────────────────────────────────────────
-- LABELS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#DBAC35',
    description TEXT,
    
    customer_count INTEGER DEFAULT 0,
    chat_count INTEGER DEFAULT 0,
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- AUTOMATIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Trigger
    trigger_type TEXT NOT NULL,
    trigger_conditions TEXT,
    
    -- Actions
    actions TEXT NOT NULL,
    
    -- Delay
    delay_minutes INTEGER DEFAULT 0,
    
    -- Stats
    triggered_count INTEGER DEFAULT 0,
    last_triggered_at TEXT,
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- AUTOMATION LOG
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER,
    phone TEXT,
    
    trigger_type TEXT,
    trigger_data TEXT,
    
    actions_executed TEXT,
    
    status TEXT DEFAULT 'success',
    error_message TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

-- ────────────────────────────────────────────────────────────────
-- CONVERSATION STATE (For Flows)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_state (
    phone TEXT PRIMARY KEY,
    
    current_flow TEXT,
    current_step TEXT,
    flow_data TEXT DEFAULT '{}',
    
    started_at TEXT,
    updated_at TEXT,
    expires_at TEXT
);

-- ────────────────────────────────────────────────────────────────
-- CARTS (Abandoned Cart Recovery)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    
    items TEXT DEFAULT '[]',
    item_count INTEGER DEFAULT 0,
    total REAL DEFAULT 0,
    
    status TEXT DEFAULT 'active',
    
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    converted_at TEXT    
);

-- ────────────────────────────────────────────────────────────────
-- COUPONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    
    type TEXT DEFAULT 'percent',
    value REAL NOT NULL,
    
    min_order REAL DEFAULT 0,
    max_discount REAL,
    
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    
    starts_at TEXT,
    expires_at TEXT,
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- ANALYTICS EVENTS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    event_type TEXT NOT NULL,
    event_name TEXT,
    
    phone TEXT,
    order_id TEXT,
    product_id TEXT,
    campaign_id TEXT,
    
    data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────
-- PUSH SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, endpoint)
);

-- ────────────────────────────────────────────────────────────────
-- PINCODES (Serviceability)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pincodes (
    pincode TEXT PRIMARY KEY,
    city TEXT,
    state TEXT,
    
    is_serviceable INTEGER DEFAULT 1,
    cod_available INTEGER DEFAULT 1,
    
    delivery_days INTEGER DEFAULT 5,
    shipping_cost REAL DEFAULT 0,
    
    courier_priority TEXT DEFAULT '[]'
);
 
-- ────────────────────────────────────────────────────────────────
-- SETTINGS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Default Settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
('business_name', '"KAAPAV Fashion Jewellery"'),
('business_phone', '"919148330016"'),
('business_email', '"kaapavin@gmail.com"'),
('business_address', '"India"'),
('ai_auto_reply', 'true'),
('auto_greeting', 'true'),
('business_hours_enabled', 'false'),
('business_hours', '{"start": "10:00", "end": "19:00"}'),
('away_message', '"We are currently away. We will respond shortly!"');

-- ════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type, created_at);

-- ════════════════════════════════════════════════════════════════
-- DEFAULT DATA
-- ════════════════════════════════════════════════════════════════

-- Default Admin User (password: admin123)
INSERT OR IGNORE INTO users (user_id, email, password_hash, name, role)
VALUES ('admin', 'admin@kaapav.com', '$2a$10$XQxBtZWVqLqFc8Yx5u5kVe5u5kVe5u5kVe5u5kVe5u5kVe5u5kVe', 'Admin', 'admin');

-- Default Labels
INSERT OR IGNORE INTO labels (name, color) VALUES 
('VIP', '#FFD700'),
('Hot Lead', '#FF6B6B'),
('New', '#4ECDC4'),
('Returning', '#45B7D1'),
('Wholesale', '#96CEB4');

-- Default Quick Replies
INSERT OR IGNORE INTO quick_replies (shortcut, title, message, category) VALUES
('hi', 'Welcome', 'Hello! 👋 Welcome to KAAPAV Fashion Jewellery. How can I help you today?', 'greeting'),
('catalog', 'Send Catalog', 'Here''s our latest collection! 💎 Browse and let me know what you like.', 'sales'),
('price', 'Price Inquiry', 'I''d be happy to help with pricing! Which product are you interested in?', 'sales'),
('order', 'Order Status', 'Let me check your order status. Could you share your order ID?', 'support'),
('cod', 'COD Available', 'Yes! We offer Cash on Delivery. 📦 Would you like to place an order?', 'sales'),
('return', 'Return Policy', 'We have a 7-day easy return policy. No questions asked! 🔄', 'support'),
('thanks', 'Thank You', 'Thank you for shopping with KAAPAV! 🙏 We appreciate your support.', 'closing');