/**
 * ════════════════════════════════════════════════════════════════
 * RAZORPAY PAYMENT SERVICE
 * Complete Payment Integration
 * ════════════════════════════════════════════════════════════════
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1';

// ════════════════════════════════════════════════════════════════
// API REQUEST HELPER
// ════════════════════════════════════════════════════════════════

async function razorpayRequest(endpoint, method, body, env) {
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  
  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${RAZORPAY_API}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    console.error('[Razorpay] Error:', data.error?.description || data);
    throw new Error(data.error?.description || 'Razorpay API error');
  }

  return data;
}

// ════════════════════════════════════════════════════════════════
// CREATE ORDER
// ════════════════════════════════════════════════════════════════

export async function createRazorpayOrder(amount, orderId, customerPhone, customerEmail, env) {
  console.log(`[Razorpay] Creating order for ₹${amount}`);
  
  const data = await razorpayRequest('/orders', 'POST', {
    amount: Math.round(amount * 100), // Convert to paise
    currency: 'INR',
    receipt: orderId,
    notes: {
      order_id: orderId,
      phone: customerPhone,
    },
  }, env);

  return {
    orderId: data.id,
    amount: data.amount / 100,
    currency: data.currency,
  };
}

// ════════════════════════════════════════════════════════════════
// CREATE PAYMENT LINK
// ════════════════════════════════════════════════════════════════

export async function createPaymentLink(order, customer, env) {
  console.log(`[Razorpay] Creating payment link for ${order.order_id}`);
  
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  
  const lineItems = items.map(item => ({
    name: item.name,
    amount: Math.round(item.price * 100),
    quantity: item.quantity,
  }));

  // Add shipping if present
  if (order.shipping_cost > 0) {
    lineItems.push({
      name: 'Shipping',
      amount: Math.round(order.shipping_cost * 100),
      quantity: 1,
    });
  }

  const data = await razorpayRequest('/payment_links', 'POST', {
    amount: Math.round(order.total * 100),
    currency: 'INR',
    accept_partial: false,
    description: `Order ${order.order_id}`,
    customer: {
      name: customer.name || order.customer_name,
      contact: customer.phone || order.phone,
      email: customer.email || undefined,
    },
    notify: {
      sms: true,
      email: !!customer.email,
      whatsapp: true,
    },
    reminder_enable: true,
    notes: {
      order_id: order.order_id,
      phone: order.phone,
    },
    callback_url: `${env.APP_URL}/payment/success?order=${order.order_id}`,
    callback_method: 'get',
    expire_by: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  }, env);

  return {
    paymentLinkId: data.id,
    shortUrl: data.short_url,
    amount: data.amount / 100,
    expiresAt: new Date(data.expire_by * 1000).toISOString(),
  };
}

// ════════════════════════════════════════════════════════════════
// VERIFY PAYMENT SIGNATURE
// ════════════════════════════════════════════════════════════════

export async function verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, signature, env) {
  const crypto = await import('node:crypto');
  
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

// ════════════════════════════════════════════════════════════════
// GET PAYMENT DETAILS
// ════════════════════════════════════════════════════════════════

export async function getPayment(paymentId, env) {
  console.log(`[Razorpay] Fetching payment ${paymentId}`);
  return razorpayRequest(`/payments/${paymentId}`, 'GET', null, env);
}

// ════════════════════════════════════════════════════════════════
// GET PAYMENT LINK STATUS
// ════════════════════════════════════════════════════════════════

export async function getPaymentLink(paymentLinkId, env) {
  console.log(`[Razorpay] Fetching payment link ${paymentLinkId}`);
  return razorpayRequest(`/payment_links/${paymentLinkId}`, 'GET', null, env);
}

// ════════════════════════════════════════════════════════════════
// CAPTURE PAYMENT
// ════════════════════════════════════════════════════════════════

export async function capturePayment(paymentId, amount, env) {
  console.log(`[Razorpay] Capturing payment ${paymentId}`);
  
  return razorpayRequest(`/payments/${paymentId}/capture`, 'POST', {
    amount: Math.round(amount * 100),
    currency: 'INR',
  }, env);
}

// ════════════════════════════════════════════════════════════════
// REFUND PAYMENT
// ════════════════════════════════════════════════════════════════

export async function refundPayment(paymentId, amount, reason, env) {
  console.log(`[Razorpay] Refunding ${paymentId}`);
  
  return razorpayRequest(`/payments/${paymentId}/refund`, 'POST', {
    amount: amount ? Math.round(amount * 100) : undefined,
    speed: 'normal',
    notes: {
      reason: reason || 'Customer request',
    },
  }, env);
}

// ════════════════════════════════════════════════════════════════
// CREATE UPI PAYMENT LINK
// ════════════════════════════════════════════════════════════════

export function generateUPILink(amount, orderId, env) {
  const upiId = env.UPI_ID || 'kaapav@upi';
  const name = 'KAAPAV';
  
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent(`Order ${orderId}`)}&cu=INR`;
}

// ════════════════════════════════════════════════════════════════
// PROCESS WEBHOOK
// ════════════════════════════════════════════════════════════════

export async function processRazorpayWebhook(event, payload, env) {
  console.log(`[Razorpay] Webhook: ${event}`);
  
  switch (event) {
    case 'payment.captured':
      return {
        type: 'payment_success',
        paymentId: payload.payment.entity.id,
        orderId: payload.payment.entity.notes?.order_id,
        amount: payload.payment.entity.amount / 100,
        method: payload.payment.entity.method,
      };
    
    case 'payment.failed':
      return {
        type: 'payment_failed',
        paymentId: payload.payment.entity.id,
        orderId: payload.payment.entity.notes?.order_id,
        reason: payload.payment.entity.error_description,
      };
    
    case 'payment_link.paid':
      return {
        type: 'payment_link_paid',
        paymentLinkId: payload.payment_link.entity.id,
        orderId: payload.payment_link.entity.notes?.order_id,
        amount: payload.payment_link.entity.amount / 100,
        paymentId: payload.payment_link.entity.payments?.[0]?.payment_id,
      };
    
    case 'refund.created':
      return {
        type: 'refund_created',
        refundId: payload.refund.entity.id,
        paymentId: payload.refund.entity.payment_id,
        amount: payload.refund.entity.amount / 100,
      };
    
    default:
      return null;
  }
}