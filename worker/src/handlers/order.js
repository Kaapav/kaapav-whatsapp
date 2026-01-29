/**
 * ════════════════════════════════════════════════════════════════
 * ORDER HANDLER
 * Complete order management
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { generateOrderId, CONFIG, formatCurrency } from '../config.js';
import { sendText, sendButtons, sendTemplate } from '../services/whatsapp.js';
import { createPaymentLink } from '../services/razorpay.js';
import { createShipment, getTracking } from '../services/shiprocket.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleOrder(request, ctx, path) {
  const { method, env, url } = ctx;
  
  try {
    // ─────────────────────────────────────────────────────────────
    // GET /api/orders - List orders
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/orders' && method === 'GET') {
      return getOrders(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/orders/stats - Order stats
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/orders/stats' && method === 'GET') {
      return getOrderStats(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/orders - Create order
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/orders' && method === 'POST') {
      return createOrder(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/orders/:id - Get single order
    // ─────────────────────────────────────────────────────────────
    const orderMatch = path.match(/^\/api\/orders\/([A-Z0-9]+)$/);
    if (orderMatch && method === 'GET') {
      return getOrder(orderMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // PUT /api/orders/:id - Update order
    // ─────────────────────────────────────────────────────────────
    if (orderMatch && method === 'PUT') {
      return updateOrder(orderMatch[1], await request.json(), ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/orders/:id/confirm - Confirm order
    // ─────────────────────────────────────────────────────────────
    const confirmMatch = path.match(/^\/api\/orders\/([A-Z0-9]+)\/confirm$/);
    if (confirmMatch && method === 'POST') {
      return confirmOrder(confirmMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/orders/:id/ship - Ship order
    // ─────────────────────────────────────────────────────────────
    const shipMatch = path.match(/^\/api\/orders\/([A-Z0-9]+)\/ship$/);
    if (shipMatch && method === 'POST') {
      return shipOrder(shipMatch[1], await request.json(), ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/orders/:id/cancel - Cancel order
    // ─────────────────────────────────────────────────────────────
    const cancelMatch = path.match(/^\/api\/orders\/([A-Z0-9]+)\/cancel$/);
    if (cancelMatch && method === 'POST') {
      return cancelOrder(cancelMatch[1], await request.json(), ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/orders/:id/payment-link - Generate payment link
    // ─────────────────────────────────────────────────────────────
    const paymentMatch = path.match(/^\/api\/orders\/([A-Z0-9]+)\/payment-link$/);
    if (paymentMatch && method === 'POST') {
      return generatePaymentLink(paymentMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/orders/:id/send-notification - Send notification
    // ─────────────────────────────────────────────────────────────
    const notifyMatch = path.match(/^\/api\/orders\/([A-Z0-9]+)\/send-notification$/);
    if (notifyMatch && method === 'POST') {
      const { type } = await request.json();
      return sendOrderNotification(notifyMatch[1], type, ctx);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Order] Error:', error.message);
    return errorResponse('Failed to process order request', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// GET ORDERS LIST
// ═════════════════════════════════════════════════════════════════

async function getOrders(ctx) {
  const { env, url } = ctx;
  
  const status = url.searchParams.get('status');
  const paymentStatus = url.searchParams.get('payment_status');
  const phone = url.searchParams.get('phone');
  const search = url.searchParams.get('search');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  let query = `SELECT * FROM orders WHERE 1=1`;
  const params = [];
  
  if (status) {
    const statuses = status.split(',');
    query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }
  
  if (paymentStatus) {
    query += ` AND payment_status = ?`;
    params.push(paymentStatus);
  }
  
  if (phone) {
    query += ` AND phone = ?`;
    params.push(phone);
  }
  
  if (search) {
    query += ` AND (order_id LIKE ? OR phone LIKE ? OR customer_name LIKE ?)`;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  
  if (startDate) {
    query += ` AND created_at >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND created_at <= ?`;
    params.push(endDate);
  }
  
  // Count
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const { total } = await env.DB.prepare(countQuery).bind(...params).first() || { total: 0 };
  
  // Get orders
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({
    orders: results.map(formatOrder),
    total,
    limit,
    offset,
  });
}

// ═════════════════════════════════════════════════════════════════
// GET ORDER STATS
// ═════════════════════════════════════════════════════════════════

async function getOrderStats(ctx) {
  const { env, url } = ctx;
  
  const period = url.searchParams.get('period') || 'today';
  
  let dateFilter = '';
  switch (period) {
    case 'today':
      dateFilter = `AND date(created_at) = date('now')`;
      break;
    case 'week':
      dateFilter = `AND created_at >= datetime('now', '-7 days')`;
      break;
    case 'month':
      dateFilter = `AND created_at >= datetime('now', '-30 days')`;
      break;
    case 'year':
      dateFilter = `AND created_at >= datetime('now', '-1 year')`;
      break;
  }
  
  // Overall stats
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(total) as total_revenue,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN 1 ELSE 0 END) as unpaid,
      AVG(total) as avg_order_value
    FROM orders WHERE 1=1 ${dateFilter}
  `).first();
  
  // Daily breakdown (last 7 days)
  const { results: daily } = await env.DB.prepare(`
    SELECT 
      date(created_at) as date,
      COUNT(*) as orders,
      SUM(total) as revenue
    FROM orders
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date DESC
  `).all();
  
  return jsonResponse({
    stats: {
      totalOrders: stats?.total_orders || 0,
      totalRevenue: stats?.total_revenue || 0,
      avgOrderValue: Math.round(stats?.avg_order_value || 0),
      byStatus: {
        pending: stats?.pending || 0,
        confirmed: stats?.confirmed || 0,
        processing: stats?.processing || 0,
        shipped: stats?.shipped || 0,
        delivered: stats?.delivered || 0,
        cancelled: stats?.cancelled || 0,
      },
      paid: stats?.paid || 0,
      unpaid: stats?.unpaid || 0,
    },
    daily,
  });
}

// ═════════════════════════════════════════════════════════════════
// CREATE ORDER
// ═════════════════════════════════════════════════════════════════

async function createOrder(request, ctx) {
  const { env } = ctx;
  const data = await request.json();
  
  const {
    phone,
    items,
    shippingAddress,
    paymentMethod,
    discountCode,
    customerNotes,
  } = data;
  
  if (!phone || !items?.length) {
    return errorResponse('Phone and items required');
  }
  
  // Get customer
  const customer = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(phone).first();
  
  // Calculate totals
  let subtotal = 0;
  const orderItems = [];
  
  for (const item of items) {
    const product = await env.DB.prepare(`
      SELECT * FROM products WHERE sku = ? AND is_active = 1
    `).bind(item.sku).first();
    
    if (!product) {
      return errorResponse(`Product ${item.sku} not found`);
    }
    
    if (product.track_inventory && product.stock < item.quantity) {
      return errorResponse(`Insufficient stock for ${product.name}`);
    }
    
    subtotal += product.price * item.quantity;
    orderItems.push({
      sku: product.sku,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      image: product.image_url,
    });
  }
  
  // Apply discount
  let discount = 0;
  if (discountCode) {
    const coupon = await env.DB.prepare(`
      SELECT * FROM coupons 
      WHERE code = ? AND is_active = 1
      AND (starts_at IS NULL OR starts_at <= datetime('now'))
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND (usage_limit IS NULL OR used_count < usage_limit)
    `).bind(discountCode.toUpperCase()).first();
    
    if (coupon && subtotal >= coupon.min_order) {
      if (coupon.type === 'percent') {
        discount = Math.min(subtotal * (coupon.value / 100), coupon.max_discount || Infinity);
      } else {
        discount = Math.min(coupon.value, subtotal);
      }
    }
  }
  
  // Calculate shipping
  const shippingCost = subtotal >= CONFIG.BUSINESS.FREE_SHIPPING_ABOVE ? 0 : CONFIG.BUSINESS.DEFAULT_SHIPPING_COST;
  
  // COD charge
  const codCharge = paymentMethod === 'cod' ? CONFIG.BUSINESS.COD_CHARGE : 0;
  
  // Total
  const total = subtotal - discount + shippingCost + codCharge;
  
  // Generate order ID
  const orderId = generateOrderId();
  
  // Create order
  await env.DB.prepare(`
    INSERT INTO orders (
      order_id, phone, customer_name, items, item_count,
      subtotal, discount, discount_code, shipping_cost, total,
      shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_pincode,
      status, payment_status, payment_method, customer_notes, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'dashboard', datetime('now'))
  `).bind(
    orderId,
    phone,
    customer?.name || shippingAddress?.name,
    JSON.stringify(orderItems),
    orderItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    discount,
    discountCode?.toUpperCase(),
    shippingCost,
    total,
    shippingAddress?.name,
    shippingAddress?.phone || phone,
    shippingAddress?.address,
    shippingAddress?.city,
    shippingAddress?.state,
    shippingAddress?.pincode,
    paymentMethod === 'cod' ? 'unpaid' : 'pending',
    paymentMethod || 'online',
    customerNotes
  ).run();
  
  // Update inventory
  for (const item of orderItems) {
    await env.DB.prepare(`
      UPDATE products SET stock = stock - ?, order_count = order_count + 1 WHERE sku = ?
    `).bind(item.quantity, item.sku).run();
  }
  
  // Clear cart
  await env.DB.prepare(`
    UPDATE carts SET status = 'converted', converted_at = datetime('now') WHERE phone = ?
  `).bind(phone).run();
  
  await env.DB.prepare(`
    UPDATE customers SET cart = '[]', cart_updated_at = NULL WHERE phone = ?
  `).bind(phone).run();
  
  // Generate payment link if online
  let paymentLink = null;
  if (paymentMethod !== 'cod') {
    const linkResult = await createPaymentLink(orderId, total, customer, env);
    if (linkResult.success) {
      paymentLink = linkResult.paymentLink;
      await env.DB.prepare(`
        UPDATE orders SET payment_link = ?, payment_link_expires = datetime('now', '+24 hours') WHERE order_id = ?
      `).bind(paymentLink, orderId).run();
    }
  }
  
  return jsonResponse({
    success: true,
    orderId,
    total,
    paymentLink,
  }, 201);
}

// ═════════════════════════════════════════════════════════════════
// GET SINGLE ORDER
// ═════════════════════════════════════════════════════════════════

async function getOrder(orderId, ctx) {
  const { env } = ctx;
  
  const order = await env.DB.prepare(`
    SELECT o.*, c.email as customer_email, c.segment, c.tier
    FROM orders o
    LEFT JOIN customers c ON o.phone = c.phone
    WHERE o.order_id = ?
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found', 404);
  }
  
  // Get payment history
  const { results: payments } = await env.DB.prepare(`
    SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
  `).bind(orderId).all();
  
  return jsonResponse({
    order: formatOrder(order),
    payments,
  });
}

// ═════════════════════════════════════════════════════════════════
// UPDATE ORDER
// ═════════════════════════════════════════════════════════════════

async function updateOrder(orderId, data, ctx) {
  const { env } = ctx;
  
  const updates = [];
  const params = [];
  
  const allowedFields = [
    'status', 'payment_status', 'tracking_id', 'tracking_url', 'courier',
    'internal_notes', 'shipping_name', 'shipping_phone', 'shipping_address',
    'shipping_city', 'shipping_state', 'shipping_pincode'
  ];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  }
  
  if (updates.length === 0) {
    return errorResponse('No updates provided');
  }
  
  updates.push('updated_at = datetime("now")');
  params.push(orderId);
  
  await env.DB.prepare(`
    UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?
  `).bind(...params).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// CONFIRM ORDER
// ═════════════════════════════════════════════════════════════════

async function confirmOrder(orderId, ctx) {
  const { env } = ctx;
  
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ? AND status = 'pending'
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found or already processed');
  }
  
  await env.DB.prepare(`
    UPDATE orders SET status = 'confirmed', confirmed_at = datetime('now'), updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(orderId).run();
  
  // Send WhatsApp notification
  const message = CONFIG.MESSAGES.ORDER_CONFIRMED(orderId, order.total);
  await sendText(order.phone, message, env);
  
  await env.DB.prepare(`
    UPDATE orders SET confirmation_sent = 1 WHERE order_id = ?
  `).bind(orderId).run();
  
  // Update customer stats
  await env.DB.prepare(`
    UPDATE customers SET 
      order_count = order_count + 1,
      total_spent = total_spent + ?,
      last_order_at = datetime('now'),
      segment = CASE 
        WHEN order_count >= 10 THEN 'vip'
        WHEN order_count >= 5 THEN 'loyal'
        WHEN order_count >= 2 THEN 'returning'
        WHEN order_count >= 1 THEN 'first_order'
        ELSE 'new'
      END
    WHERE phone = ?
  `).bind(order.total, order.phone).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// SHIP ORDER
// ═════════════════════════════════════════════════════════════════

async function shipOrder(orderId, data, ctx) {
  const { env } = ctx;
  
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ? AND status IN ('confirmed', 'processing')
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found or cannot be shipped');
  }
  
  const { courier, trackingId, trackingUrl, useShiprocket } = data;
  
  let shipmentDetails = { courier, trackingId, trackingUrl };
  
  // Create Shiprocket shipment if enabled
  if (useShiprocket) {
    const result = await createShipment(order, env);
    if (result.success) {
      shipmentDetails = {
        courier: result.courier,
        trackingId: result.awb,
        trackingUrl: result.trackingUrl,
        shipmentId: result.shipmentId,
      };
    }
  }
  
  await env.DB.prepare(`
    UPDATE orders SET 
      status = 'shipped',
      courier = ?,
      tracking_id = ?,
      tracking_url = ?,
      shipment_id = ?,
      shipped_at = datetime('now'),
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(
    shipmentDetails.courier,
    shipmentDetails.trackingId,
    shipmentDetails.trackingUrl,
    shipmentDetails.shipmentId,
    orderId
  ).run();
  
  // Send WhatsApp notification
  const message = CONFIG.MESSAGES.ORDER_SHIPPED(orderId, shipmentDetails.trackingId, shipmentDetails.trackingUrl);
  await sendText(order.phone, message, env);
  
  await env.DB.prepare(`
    UPDATE orders SET shipping_sent = 1 WHERE order_id = ?
  `).bind(orderId).run();
  
  return jsonResponse({ success: true, ...shipmentDetails });
}

// ═════════════════════════════════════════════════════════════════
// CANCEL ORDER
// ═════════════════════════════════════════════════════════════════

async function cancelOrder(orderId, data, ctx) {
  const { env } = ctx;
  
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ? AND status NOT IN ('delivered', 'cancelled')
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found or cannot be cancelled');
  }
  
  await env.DB.prepare(`
    UPDATE orders SET 
      status = 'cancelled',
      cancellation_reason = ?,
      cancelled_at = datetime('now'),
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(data.reason, orderId).run();
  
  // Restore inventory
  const items = JSON.parse(order.items);
  for (const item of items) {
    await env.DB.prepare(`
      UPDATE products SET stock = stock + ? WHERE sku = ?
    `).bind(item.quantity, item.sku).run();
  }
  
  // Notify customer
  await sendText(order.phone, `❌ Order ${orderId} has been cancelled.\n\nReason: ${data.reason || 'N/A'}\n\nIf you have questions, please contact us.`, env);
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// GENERATE PAYMENT LINK
// ═════════════════════════════════════════════════════════════════

async function generatePaymentLink(orderId, ctx) {
  const { env } = ctx;
  
  const order = await env.DB.prepare(`
    SELECT o.*, c.name, c.email FROM orders o
    LEFT JOIN customers c ON o.phone = c.phone
    WHERE o.order_id = ? AND o.payment_status != 'paid'
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found or already paid');
  }
  
  const result = await createPaymentLink(orderId, order.total, { 
    name: order.customer_name || order.name, 
    email: order.email, 
    phone: order.phone 
  }, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to create payment link');
  }
  
  await env.DB.prepare(`
    UPDATE orders SET payment_link = ?, payment_link_expires = datetime('now', '+24 hours'), updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(result.paymentLink, orderId).run();
  
  // Send to customer
  await sendButtons(order.phone, `💳 Payment Link\n\n📦 Order: ${orderId}\n💰 Amount: ₹${order.total}\n\nClick below to pay:`, [
    { id: `open_payment_${orderId}`, title: '💳 Pay Now' }
  ], env);
  
  // Actually send the link
  await sendText(order.phone, result.paymentLink, env);
  
  return jsonResponse({ success: true, paymentLink: result.paymentLink });
}

// ═════════════════════════════════════════════════════════════════
// SEND ORDER NOTIFICATION
// ═════════════════════════════════════════════════════════════════

async function sendOrderNotification(orderId, type, ctx) {
  const { env } = ctx;
  
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found', 404);
  }
  
  let message = '';
  
  switch (type) {
    case 'confirmation':
      message = CONFIG.MESSAGES.ORDER_CONFIRMED(orderId, order.total);
      break;
    case 'shipped':
      message = CONFIG.MESSAGES.ORDER_SHIPPED(orderId, order.tracking_id, order.tracking_url);
      break;
    case 'delivered':
      message = CONFIG.MESSAGES.ORDER_DELIVERED(orderId);
      break;
    case 'payment_reminder':
      message = CONFIG.MESSAGES.PAYMENT_REMINDER(orderId, order.total, order.payment_link);
      break;
    default:
      return errorResponse('Invalid notification type');
  }
  
  await sendText(order.phone, message, env);
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// FORMATTERS
// ═════════════════════════════════════════════════════════════════

function formatOrder(order) {
  return {
    orderId: order.order_id,
    phone: order.phone,
    customerName: order.customer_name,
    items: safeJsonParse(order.items, []),
    itemCount: order.item_count,
    subtotal: order.subtotal,
    discount: order.discount,
    discountCode: order.discount_code,
    shippingCost: order.shipping_cost,
    tax: order.tax,
    total: order.total,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    paymentLink: order.payment_link,
    shipping: {
      name: order.shipping_name,
      phone: order.shipping_phone,
      address: order.shipping_address,
      city: order.shipping_city,
      state: order.shipping_state,
      pincode: order.shipping_pincode,
    },
    tracking: {
      courier: order.courier,
      trackingId: order.tracking_id,
      trackingUrl: order.tracking_url,
    },
    notes: {
      customer: order.customer_notes,
      internal: order.internal_notes,
    },
    timestamps: {
      created: order.created_at,
      confirmed: order.confirmed_at,
      shipped: order.shipped_at,
      delivered: order.delivered_at,
      cancelled: order.cancelled_at,
    },
    source: order.source,
  };
}

function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}