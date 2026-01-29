/**
 * ════════════════════════════════════════════════════════════════
 * PUSH NOTIFICATIONS
 * Web push notification handling
 * ════════════════════════════════════════════════════════════════
 */

import api from '../api';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// ═══════════════════════════════════════════════════════════════
// PERMISSION & SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get notification permission status
 */
export function getPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestPermission() {
  if (!isPushSupported()) {
    return { granted: false, reason: 'unsupported' };
  }
  
  try {
    const permission = await Notification.requestPermission();
    return { 
      granted: permission === 'granted',
      permission 
    };
  } catch (error) {
    return { granted: false, reason: error.message };
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }
  
  // Check permission
  if (Notification.permission !== 'granted') {
    const { granted } = await requestPermission();
    if (!granted) {
      throw new Error('Notification permission denied');
    }
  }
  
  // Get service worker registration
  const registration = await navigator.serviceWorker.ready;
  
  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    // Already subscribed, send to server
    await sendSubscriptionToServer(subscription);
    return subscription;
  }
  
  // Subscribe
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    
    // Send to server
    await sendSubscriptionToServer(subscription);
    
    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
    // TODO: Notify server to remove subscription
  }
}

/**
 * Send subscription to server
 */
async function sendSubscriptionToServer(subscription) {
  try {
    const subscriptionJSON = subscription.toJSON();
    
    await api.push.subscribe({
      endpoint: subscriptionJSON.endpoint,
      keys: {
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth,
      },
    });
    
    console.log('[Push] Subscription saved to server');
  } catch (error) {
    console.error('[Push] Failed to save subscription:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// LOCAL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Show local notification
 */
export async function showNotification(title, options = {}) {
  if (!isPushSupported()) return;
  
  if (Notification.permission !== 'granted') {
    return;
  }
  
  const registration = await navigator.serviceWorker.ready;
  
  await registration.showNotification(title, {
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    ...options,
  });
}

/**
 * Show new message notification
 */
export async function showMessageNotification(phone, name, message) {
  await showNotification(`New message from ${name || phone}`, {
    body: message.slice(0, 100),
    tag: `message-${phone}`,
    data: { type: 'message', phone },
    actions: [
      { action: 'reply', title: 'Reply' },
      { action: 'view', title: 'View' },
    ],
    requireInteraction: true,
  });
}

/**
 * Show new order notification
 */
export async function showOrderNotification(orderId, amount) {
  await showNotification('🛍️ New Order!', {
    body: `Order ${orderId} - ₹${amount}`,
    tag: `order-${orderId}`,
    data: { type: 'order', orderId },
    requireInteraction: true,
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}