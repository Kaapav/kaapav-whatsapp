/**
 * ════════════════════════════════════════════════════════════════
 * WEB PUSH NOTIFICATION SERVICE
 * Push notifications for dashboard users
 * ════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════
// VAPID SIGNATURE GENERATION
// ═════════════════════════════════════════════════════════════════

async function generateVapidSignature(audience, subject, publicKey, privateKey) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12 hours
    sub: subject,
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  // Import private key
  const keyData = base64UrlDecode(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Sign
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  
  return `${unsignedToken}.${encodedSignature}`;
}

// ═════════════════════════════════════════════════════════════════
// SEND PUSH NOTIFICATION TO USER
// ═════════════════════════════════════════════════════════════════

export async function sendPushNotification(userId, notification, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.log('[Push] VAPID keys not configured');
    return { success: false, error: 'Push not configured' };
  }
  
  // Get user subscriptions
  const { results: subscriptions } = await env.DB.prepare(`
    SELECT * FROM push_subscriptions WHERE user_id = ? AND is_active = 1
  `).bind(userId).all();
  
  if (!subscriptions?.length) {
    return { success: false, error: 'No active subscriptions' };
  }
  
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon || '/icons/icon-192.png',
    badge: notification.badge || '/icons/badge-72.png',
    data: notification.data || {},
    actions: notification.actions || [],
    tag: notification.tag,
    requireInteraction: notification.requireInteraction || false,
    renotify: notification.renotify || false,
    silent: notification.silent || false,
    timestamp: Date.now(),
  });
  
  const results = [];
  
  for (const subscription of subscriptions) {
    try {
      const result = await sendToEndpoint(
        subscription.endpoint,
        subscription.p256dh,
        subscription.auth,
        payload,
        env
      );
      
      results.push({ endpoint: subscription.endpoint, ...result });
      
      // Remove invalid subscriptions
      if (!result.success && result.statusCode === 410) {
        await env.DB.prepare(`
          DELETE FROM push_subscriptions WHERE id = ?
        `).bind(subscription.id).run();
      }
    } catch (error) {
      results.push({ endpoint: subscription.endpoint, success: false, error: error.message });
    }
  }
  
  return {
    success: results.some(r => r.success),
    results,
  };
}

// ═════════════════════════════════════════════════════════════════
// SEND TO ALL USERS WITH ROLE
// ═════════════════════════════════════════════════════════════════

export async function sendPushToRole(role, notification, env) {
  const { results: users } = await env.DB.prepare(`
    SELECT DISTINCT ps.user_id 
    FROM push_subscriptions ps
    JOIN users u ON ps.user_id = u.user_id
    WHERE u.role = ? OR u.role = 'admin'
    AND ps.is_active = 1
  `).bind(role).all();
  
  const results = [];
  
  for (const user of users) {
    const result = await sendPushNotification(user.user_id, notification, env);
    results.push({ userId: user.user_id, ...result });
  }
  
  return {
    success: results.some(r => r.success),
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  };
}

// ═════════════════════════════════════════════════════════════════
// SEND TO ALL USERS
// ═════════════════════════════════════════════════════════════════

export async function sendPushToAll(notification, env) {
  const { results: subscriptions } = await env.DB.prepare(`
    SELECT DISTINCT user_id FROM push_subscriptions WHERE is_active = 1
  `).all();
  
  const results = [];
  
  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub.user_id, notification, env);
    results.push({ userId: sub.user_id, ...result });
  }
  
  return {
    success: results.some(r => r.success),
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  };
}

// ═════════════════════════════════════════════════════════════════
// LOW-LEVEL SEND TO ENDPOINT
// ═════════════════════════════════════════════════════════════════

async function sendToEndpoint(endpoint, p256dh, auth, payload, env) {
  try {
    // Parse endpoint URL to get audience
    const endpointUrl = new URL(endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    
    // Generate VAPID authorization
    const vapidToken = await generateVapidSignature(
      audience,
      `mailto:${env.VAPID_SUBJECT || 'admin@kaapav.com'}`,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    
    // Encrypt payload
    const encryptedPayload = await encryptPayload(payload, p256dh, auth);
    
    // Send request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${vapidToken}, k=${env.VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body: encryptedPayload,
    });
    
    if (response.ok || response.status === 201) {
      return { success: true };
    }
    
    return {
      success: false,
      statusCode: response.status,
      error: await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ═════════════════════════════════════════════════════════════════
// PAYLOAD ENCRYPTION (Simplified - for production use web-push library)
// ═════════════════════════════════════════════════════════════════

async function encryptPayload(payload, p256dh, auth) {
  // Note: This is a simplified version
  // For production, consider using a proper web-push encryption library
  // or implementing full RFC 8291 encryption
  
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  // For now, return unencrypted payload
  // Push services that require encryption will reject this
  // Implement proper aes128gcm encryption for production
  return payloadBytes;
}

// ═════════════════════════════════════════════════════════════════
// NOTIFICATION TEMPLATES
// ═════════════════════════════════════════════════════════════════

export const PUSH_TEMPLATES = {
  NEW_MESSAGE: (phone, message) => ({
    title: '💬 New Message',
    body: `${phone}: ${message.slice(0, 50)}...`,
    data: { type: 'new_message', phone },
    tag: `message-${phone}`,
    requireInteraction: true,
    actions: [
      { action: 'reply', title: 'Reply' },
      { action: 'view', title: 'View' },
    ],
  }),
  
  NEW_ORDER: (orderId, amount) => ({
    title: '🛍️ New Order!',
    body: `Order ${orderId} - ₹${amount}`,
    data: { type: 'new_order', orderId },
    tag: `order-${orderId}`,
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Order' },
    ],
  }),
  
  PAYMENT_RECEIVED: (orderId, amount) => ({
    title: '💰 Payment Received!',
    body: `₹${amount} for Order ${orderId}`,
    data: { type: 'payment', orderId },
    tag: `payment-${orderId}`,
  }),
  
  LOW_STOCK: (productName, stock) => ({
    title: '⚠️ Low Stock Alert',
    body: `${productName} - Only ${stock} left`,
    data: { type: 'low_stock', productName },
    tag: 'low-stock',
  }),
  
  CHAT_ASSIGNED: (phone, assignedBy) => ({
    title: '📱 Chat Assigned',
    body: `Chat with ${phone} assigned to you`,
    data: { type: 'chat_assigned', phone },
    tag: `assigned-${phone}`,
  }),
  
  BROADCAST_COMPLETE: (broadcastId, sent, failed) => ({
    title: '📢 Broadcast Complete',
    body: `Sent: ${sent}, Failed: ${failed}`,
    data: { type: 'broadcast_complete', broadcastId },
    tag: `broadcast-${broadcastId}`,
  }),
};

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function base64UrlEncode(data) {
  let str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}