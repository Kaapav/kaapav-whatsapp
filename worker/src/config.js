/**
 * ════════════════════════════════════════════════════════════════
 * KAAPAV CONFIGURATION
 * Central configuration management
 * ════════════════════════════════════════════════════════════════
 */

export const CONFIG = {
  // ─────────────────────────────────────────────────────────────
  // APP SETTINGS
  // ─────────────────────────────────────────────────────────────
  APP: {
    NAME: 'KAAPAV Fashion Jewellery',
    SHORT_NAME: 'KAAPAV',
    VERSION: '1.0.0',
    CURRENCY: 'INR',
    CURRENCY_SYMBOL: '₹',
    DEFAULT_LANGUAGE: 'en',
    TIMEZONE: 'Asia/Kolkata',
  },

  // ─────────────────────────────────────────────────────────────
  // BUSINESS SETTINGS
  // ─────────────────────────────────────────────────────────────
  BUSINESS: {
    MIN_ORDER_VALUE: 99,
    FREE_SHIPPING_ABOVE: 499,
    COD_AVAILABLE: true,
    COD_MIN_ORDER: 199,
    COD_MAX_ORDER: 10000,
    COD_CHARGE: 40,
    DEFAULT_SHIPPING_COST: 60,
    GST_PERCENTAGE: 18,
    MAX_CART_ITEMS: 20,
    MAX_QUANTITY_PER_ITEM: 10,
  },

  // ─────────────────────────────────────────────────────────────
  // ORDER STATUSES
  // ─────────────────────────────────────────────────────────────
  ORDER_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned',
    REFUNDED: 'refunded',
  },

  PAYMENT_STATUS: {
    UNPAID: 'unpaid',
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PARTIAL_REFUND: 'partial_refund',
  },

  // ─────────────────────────────────────────────────────────────
  // CUSTOMER SEGMENTS
  // ─────────────────────────────────────────────────────────────
  SEGMENTS: {
    NEW: { name: 'new', minOrders: 0, maxOrders: 0 },
    FIRST_ORDER: { name: 'first_order', minOrders: 1, maxOrders: 1 },
    RETURNING: { name: 'returning', minOrders: 2, maxOrders: 4 },
    LOYAL: { name: 'loyal', minOrders: 5, maxOrders: 9 },
    VIP: { name: 'vip', minOrders: 10 },
  },

  TIERS: {
    BRONZE: { name: 'bronze', minSpent: 0 },
    SILVER: { name: 'silver', minSpent: 2000 },
    GOLD: { name: 'gold', minSpent: 5000 },
    PLATINUM: { name: 'platinum', minSpent: 15000 },
    DIAMOND: { name: 'diamond', minSpent: 50000 },
  },

  // ─────────────────────────────────────────────────────────────
  // RATE LIMITS
  // ─────────────────────────────────────────────────────────────
  RATE_LIMITS: {
    API_REQUESTS_PER_MINUTE: 100,
    MESSAGE_SENDS_PER_MINUTE: 30,
    BROADCAST_SENDS_PER_SECOND: 10,
    LOGIN_ATTEMPTS_PER_HOUR: 5,
  },

  // ─────────────────────────────────────────────────────────────
  // WHATSAPP
  // ─────────────────────────────────────────────────────────────
  WHATSAPP: {
    API_VERSION: 'v18.0',
    API_URL: 'https://graph.facebook.com',
    MESSAGE_TYPES: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'interactive', 'template'],
    MAX_BUTTONS: 3,
    MAX_LIST_SECTIONS: 10,
    MAX_LIST_ROWS: 10,
    MAX_TEXT_LENGTH: 4096,
    MAX_CAPTION_LENGTH: 1024,
  },

  // ─────────────────────────────────────────────────────────────
  // AUTOMATION TRIGGERS
  // ─────────────────────────────────────────────────────────────
  AUTOMATION_TRIGGERS: {
    NEW_CUSTOMER: 'new_customer',
    NEW_ORDER: 'new_order',
    ORDER_CONFIRMED: 'order_confirmed',
    ORDER_SHIPPED: 'order_shipped',
    ORDER_DELIVERED: 'order_delivered',
    PAYMENT_RECEIVED: 'payment_received',
    CART_ABANDONED: 'cart_abandoned',
    CUSTOMER_INACTIVE: 'customer_inactive',
    KEYWORD_MATCH: 'keyword_match',
  },

  // ─────────────────────────────────────────────────────────────
  // CRON SCHEDULES
  // ─────────────────────────────────────────────────────────────
  CRON: {
    CART_RECOVERY_DELAY_MINUTES: 60,
    CART_REMINDER_MAX_COUNT: 3,
    PAYMENT_REMINDER_DELAY_MINUTES: 30,
    REVIEW_REQUEST_DELAY_DAYS: 3,
    INACTIVE_CUSTOMER_DAYS: 30,
  },

  // ─────────────────────────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────────────────────────
  MESSAGES: {
    ORDER_CONFIRMED: (orderId, total) => 
      `✅ Order Confirmed!\n\n📦 Order ID: ${orderId}\n💰 Total: ₹${total}\n\nWe're preparing your order!`,
    
    ORDER_SHIPPED: (orderId, trackingId, trackingUrl) => 
      `🚚 Order Shipped!\n\n📦 Order: ${orderId}\n🔍 Tracking: ${trackingId}\n\n${trackingUrl ? `Track here: ${trackingUrl}` : 'Track updates coming soon!'}`,
    
    ORDER_DELIVERED: (orderId) => 
      `✅ Order Delivered!\n\n📦 Order: ${orderId}\n\nThank you for shopping with KAAPAV! ❤️\n\nWe'd love your feedback!`,
    
    PAYMENT_REMINDER: (orderId, amount, paymentLink) => 
      `⏰ Payment Pending\n\n📦 Order: ${orderId}\n💰 Amount: ₹${amount}\n\nComplete payment: ${paymentLink}`,
    
    CART_REMINDER: (itemCount, total) => 
      `Hey! You left ${itemCount} item(s) in your cart 🛒\n\n💰 Total: ₹${total}\n\nComplete your order now!`,
  },
};

// ═════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════════════════

export function generateOrderId() {
  const prefix = 'KP';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function generateBroadcastId() {
  return `BC${Date.now().toString(36).toUpperCase()}`;
}

export function generatePaymentId() {
  return `PAY${Date.now().toString(36).toUpperCase()}`;
}

export function calculateSegment(orderCount) {
  if (orderCount >= 10) return 'vip';
  if (orderCount >= 5) return 'loyal';
  if (orderCount >= 2) return 'returning';
  if (orderCount === 1) return 'first_order';
  return 'new';
}

export function calculateTier(totalSpent) {
  if (totalSpent >= 50000) return 'diamond';
  if (totalSpent >= 15000) return 'platinum';
  if (totalSpent >= 5000) return 'gold';
  if (totalSpent >= 2000) return 'silver';
  return 'bronze';
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPhone(phone) {
  // Ensure phone has country code
  if (!phone.startsWith('91') && phone.length === 10) {
    return `91${phone}`;
  }
  return phone.replace(/\D/g, '');
}

export function sanitizePhone(phone) {
  return phone.replace(/\D/g, '').slice(-10);
}