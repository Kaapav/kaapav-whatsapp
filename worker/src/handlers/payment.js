/**
 * ════════════════════════════════════════════════════════════════
 * PAYMENT HANDLER
 * Razorpay integration with webhook handling
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { createPaymentLink, verifyPaymentSignature, refundPayment } from '../services/razorpay.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { CONFIG } from '../config.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handlePayment(request, env, pathOrAction) {
  try {
    // Webhook handler
    if (pathOrAction === 'webhook') {
      return handleWebhook(request, env);
    }
    
    // API routes
    const path = pathOrAction;
    const method = request.method;
    
    // GET /api/payments - List payments
    if (path === '/api/payments' && method === 'GET') {
      return getPayments(request, env);
    }
    
    // POST /api/payments/create-link - Create payment link
    if (path === '/api/payments/create-link' && method === 'POST') {
      return createLink(request, env);
    }
    
    // POST /api/payments/verify - Verify payment
    if (path === '/api/payments/verify' && method === 'POST') {
      return verify(request, env);
    }
    
    // POST /api/payments/refund - Initiate refund
    if (path === '/api/payments/refund' && method === 'POST') {
      return refund(request, env);
    }
    
    // GET /api/payments/:id - Get payment details
    const paymentMatch = path.match(/^\/api\/payments\/([A-Za-z0-9_]+)$/);
    if (paymentMatch && method === 'GET') {
      return getPayment(paymentMatch[1], env);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Payment] Error:', error.message);
    return errorResponse('Payment processing error', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// RAZORPAY WEBHOOK
// ═════════════════════════════════════════════════════════════════

async function handleWebhook(request, env) {
  const body = await request.text();
  const signature = request.headers.get('X-Razorpay-Signature');
  
  // Verify webhook signature
  const isValid = await verifyWebhookSignature(body, signature, env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET);
  
  if (!isValid) {
    console.error('[Payment Webhook] Invalid signature');
    return errorResponse('Invalid signature', 401);
  }
  
  const event = JSON.parse(body);
  console.log(`[Payment Webhook] Event: ${event.event}`);
  
  switch (event.event) {
    case 'payment.captured':
      await handlePaymentCaptured(event.payload.payment.entity, env);
      break;
      
    case 'payment.failed':
      await handlePaymentFailed(event.payload.payment.entity, env);
      break;
      
    case 'payment_link.paid':
      await handlePaymentLinkPaid(event.payload.payment_link.entity, event.payload.payment.entity, env);
      break;
      
    case 'refund.created':
      await handleRefundCreated(event.payload.refund.entity, env);
      break;
      
    default:
      console.log(`[Payment Webhook] Unhandled event: ${event.event}`);
  }
  
  return jsonResponse({ status: 'ok' });
}

async function handlePaymentCaptured(payment, env) {
  const orderId = payment.notes?.order_id;
  
  if (!orderId) {
    console.log('[Payment] No order_id in payment notes');
    return;
  }
  
  // Get order
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();
  
  if (!order) {
    console.log(`[Payment] Order not found: ${orderId}`);
    return;
  }
  
  // Update order
  await env.DB.prepare(`
    UPDATE orders SET
      payment_status = 'paid',
      payment_id = ?,
      paid_at = datetime('now'),
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
      confirmed_at = CASE WHEN status = 'pending' THEN datetime('now') ELSE confirmed_at END,
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(payment.id, orderId).run();
  
  // Save payment record
  await env.DB.prepare(`
    INSERT INTO payments (
      payment_id, order_id, phone, gateway, gateway_payment_id,
      amount, currency, status, method, paid_at, created_at
    ) VALUES (?, ?, ?, 'razorpay', ?, ?, 'INR', 'captured', ?, datetime('now'), datetime('now'))
  `).bind(
    `PAY${Date.now().toString(36)}`,
    orderId,
    order.phone,
    payment.id,
    payment.amount / 100, // Razorpay uses paise
    payment.method
  ).run();
  
  // Update customer stats
  await env.DB.prepare(`
    UPDATE customers SET
      order_count = order_count + 1,
      total_spent = total_spent + ?,
      last_order_at = datetime('now'),
      updated_at = datetime('now')
    WHERE phone = ?
  `).bind(order.total, order.phone).run();
  
  // Send WhatsApp notification
  const message = `✅ Payment Received!

📦 Order: ${orderId}
💰 Amount: ₹${order.total}
📝 Payment ID: ${payment.id}

Thank you for your purchase! We're preparing your order.`;
  
  await sendText(order.phone, message, env);
  
  console.log(`[Payment] Order ${orderId} payment captured: ${payment.id}`);
}

async function handlePaymentFailed(payment, env) {
  const orderId = payment.notes?.order_id;
  
  if (!orderId) return;
  
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();
  
  if (!order) return;
  
  // Log failed payment
  await env.DB.prepare(`
    INSERT INTO payments (
      payment_id, order_id, phone, gateway, gateway_payment_id,
      amount, currency, status, failed_at, created_at
    ) VALUES (?, ?, ?, 'razorpay', ?, ?, 'INR', 'failed', datetime('now'), datetime('now'))
  `).bind(
    `PAY${Date.now().toString(36)}`,
    orderId,
    order.phone,
    payment.id,
    payment.amount / 100
  ).run();
  
  // Send failure notification
  const message = `❌ Payment Failed

📦 Order: ${orderId}
💰 Amount: ₹${order.total}

Don't worry! You can try again using the payment link.

Need help? Type 'support' to chat with us.`;
  
  const buttons = [
    { id: `retry_payment_${orderId}`, title: '🔄 Try Again' },
    { id: 'talk_support', title: '💬 Get Help' },
  ];
  
  await sendButtons(order.phone, message, buttons, env);
  
  console.log(`[Payment] Order ${orderId} payment failed: ${payment.id}`);
}

async function handlePaymentLinkPaid(paymentLink, payment, env) {
  // Extract order ID from reference
  const orderId = paymentLink.reference_id;
  
  if (orderId) {
    await handlePaymentCaptured({ ...payment, notes: { order_id: orderId } }, env);
  }
}

async function handleRefundCreated(refund, env) {
  const paymentId = refund.payment_id;
  
  await env.DB.prepare(`
    UPDATE payments SET
      refund_amount = refund_amount + ?,
      refund_id = ?,
      refunded_at = datetime('now'),
      status = CASE WHEN refund_amount + ? >= amount THEN 'refunded' ELSE 'partial_refund' END
    WHERE gateway_payment_id = ?
  `).bind(refund.amount / 100, refund.id, refund.amount / 100, paymentId).run();
  
  console.log(`[Payment] Refund created: ${refund.id} for ${paymentId}`);
}

// ═════════════════════════════════════════════════════════════════
// API HANDLERS
// ═════════════════════════════════════════════════════════════════

async function getPayments(request, env) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id');
  const phone = url.searchParams.get('phone');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  
  let query = `SELECT * FROM payments WHERE 1=1`;
  const params = [];
  
  if (orderId) {
    query += ` AND order_id = ?`;
    params.push(orderId);
  }
  
  if (phone) {
    query += ` AND phone = ?`;
    params.push(phone);
  }
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({ payments: results });
}

async function getPayment(paymentId, env) {
  const payment = await env.DB.prepare(`
    SELECT p.*, o.order_id, o.total as order_total, o.status as order_status
    FROM payments p
    LEFT JOIN orders o ON p.order_id = o.order_id
    WHERE p.payment_id = ? OR p.gateway_payment_id = ?
  `).bind(paymentId, paymentId).first();
  
  if (!payment) {
    return errorResponse('Payment not found', 404);
  }
  
  return jsonResponse({ payment });
}

async function createLink(request, env) {
  const { orderId, amount, customer } = await request.json();
  
  if (!orderId || !amount) {
    return errorResponse('Order ID and amount required');
  }
  
  // First get the order
const order = await env.DB.prepare(`
  SELECT * FROM orders WHERE order_id = ?
`).bind(orderId).first();

if (!order) {
  return errorResponse('Order not found', 404);
}

const result = await createPaymentLink(order, customer, env);
  
  
  
  // Update order with payment link
  await env.DB.prepare(`
    UPDATE orders SET
      payment_link = ?,
      payment_link_expires = datetime('now', '+24 hours'),
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(result.shortUrl, orderId).run();
  
  return jsonResponse({
    success: true,
    paymentLink: result.shortUrl,
paymentLinkId: result.paymentLinkId,
  });
}

async function verify(request, env) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = await request.json();
  
  const isValid = await verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, env);
  
  if (!isValid) {
    return errorResponse('Payment verification failed');
  }
  
  // Update order
  if (order_id) {
    await env.DB.prepare(`
      UPDATE orders SET
        payment_status = 'paid',
        payment_id = ?,
        paid_at = datetime('now'),
        status = 'confirmed',
        confirmed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE order_id = ?
    `).bind(razorpay_payment_id, order_id).run();
  }
  
  return jsonResponse({ success: true, verified: true });
}

async function refund(request, env) {
  const { paymentId, amount, reason } = await request.json();
  
  if (!paymentId) {
    return errorResponse('Payment ID required');
  }
  
  // Get original payment
  const payment = await env.DB.prepare(`
    SELECT * FROM payments WHERE gateway_payment_id = ?
  `).bind(paymentId).first();
  
  if (!payment) {
    return errorResponse('Payment not found', 404);
  }
  
  const refundAmount = amount || payment.amount;
  
  const result = await refundPayment(paymentId, refundAmount, reason, env);
  
  
  
  // Update order status
  await env.DB.prepare(`
    UPDATE orders SET
      payment_status = CASE WHEN ? >= total THEN 'refunded' ELSE 'partial_refund' END,
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(refundAmount, payment.order_id).run();
  
  return jsonResponse({
    success: true,
    refundId: result.id,
amount: result.amount / 100,
  });
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

async function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}