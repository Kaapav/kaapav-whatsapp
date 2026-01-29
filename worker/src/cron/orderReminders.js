/**
 * ════════════════════════════════════════════════════════════════
 * ORDER & PAYMENT REMINDERS
 * Automated order status notifications
 * ════════════════════════════════════════════════════════════════
 */

import { sendText, sendButtons, sendTemplate } from '../services/whatsapp.js';
import { CONFIG } from '../config.js';

// ═════════════════════════════════════════════════════════════════
// PROCESS ORDER REMINDERS
// ═════════════════════════════════════════════════════════════════

export async function processOrderReminders(env) {
  const results = { success: true, processed: 0, sent: 0, errors: 0 };
  
  // 1. Payment reminders for unpaid online orders
  await processPaymentReminders(env, results);
  
  // 2. Delivery confirmation requests
  await processDeliveryConfirmation(env, results);
  
  // 3. Review requests after delivery
  await processReviewRequests(env, results);
  
  // 4. Reorder suggestions for repeat customers
  await processReorderSuggestions(env, results);
  
  return results;
}

// ═════════════════════════════════════════════════════════════════
// PAYMENT REMINDERS
// ═════════════════════════════════════════════════════════════════

async function processPaymentReminders(env, results) {
  // Get unpaid orders with valid payment links
  const { results: orders } = await env.DB.prepare(`
    SELECT o.*, c.name as customer_name, c.opted_in
    FROM orders o
    JOIN customers c ON o.phone = c.phone
    WHERE o.status = 'pending'
    AND o.payment_status IN ('pending', 'unpaid')
    AND o.payment_method = 'online'
    AND o.payment_link IS NOT NULL
    AND o.payment_link_expires > datetime('now')
    AND o.created_at > datetime('now', '-24 hours')
    AND o.created_at < datetime('now', '-30 minutes')
    AND c.opted_in = 1
    LIMIT 20
  `).all();
  
  for (const order of orders || []) {
    try {
      results.processed++;
      
      // Check if reminder already sent recently
      const recentReminder = await env.DB.prepare(`
        SELECT id FROM analytics 
        WHERE event_type = 'order' AND event_name = 'payment_reminder'
        AND order_id = ? AND created_at > datetime('now', '-2 hours')
      `).bind(order.order_id).first();
      
      if (recentReminder) continue;
      
      const name = order.customer_name?.split(' ')[0] || 'there';
      
      const message = `Hi ${name}! 💳

Your order *${order.order_id}* is waiting for payment.

💰 Amount: ₹${order.total}

Complete payment to confirm your order:
${order.payment_link}

⏰ Link expires in ${getTimeRemaining(order.payment_link_expires)}

Need help? Reply 'support'`;
      
      const result = await sendText(order.phone, message, env);
      
      if (result.success) {
        results.sent++;
        
        await env.DB.prepare(`
          INSERT INTO analytics (event_type, event_name, phone, order_id, created_at)
          VALUES ('order', 'payment_reminder', ?, ?, datetime('now'))
        `).bind(order.phone, order.order_id).run();
      }
      
      await sleep(200);
      
    } catch (error) {
      results.errors++;
    }
  }
}

// ═════════════════════════════════════════════════════════════════
// DELIVERY CONFIRMATION
// ═════════════════════════════════════════════════════════════════

async function processDeliveryConfirmation(env, results) {
  // Get orders that should be delivered by now (based on courier estimates)
  const { results: orders } = await env.DB.prepare(`
    SELECT o.*, c.name as customer_name, c.opted_in
    FROM orders o
    JOIN customers c ON o.phone = c.phone
    WHERE o.status = 'shipped'
    AND o.shipped_at < datetime('now', '-5 days')
    AND o.delivery_sent = 0
    AND c.opted_in = 1
    LIMIT 10
  `).all();
  
  for (const order of orders || []) {
    try {
      results.processed++;
      
      const name = order.customer_name?.split(' ')[0] || 'there';
      
      const message = `Hi ${name}! 📦

Has your order *${order.order_id}* been delivered?

Please confirm so we can update our records.`;
      
      const buttons = [
        { id: `delivered_${order.order_id}`, title: '✅ Yes, Delivered' },
        { id: `not_delivered_${order.order_id}`, title: '❌ Not Yet' },
        { id: `order_track_${order.order_id}`, title: '📍 Track Order' },
      ];
      
      const result = await sendButtons(order.phone, message, buttons, env);
      
      if (result.success) {
        results.sent++;
        
        await env.DB.prepare(`
          UPDATE orders SET delivery_sent = 1 WHERE order_id = ?
        `).bind(order.order_id).run();
      }
      
      await sleep(200);
      
    } catch (error) {
      results.errors++;
    }
  }
}

// ═════════════════════════════════════════════════════════════════
// REVIEW REQUESTS
// ═════════════════════════════════════════════════════════════════

async function processReviewRequests(env, results) {
  // Get delivered orders without review request
  const { results: orders } = await env.DB.prepare(`
    SELECT o.*, c.name as customer_name, c.opted_in
    FROM orders o
    JOIN customers c ON o.phone = c.phone
    WHERE o.status = 'delivered'
    AND o.delivered_at < datetime('now', '-3 days')
    AND o.delivered_at > datetime('now', '-7 days')
    AND o.review_sent = 0
    AND c.opted_in = 1
    LIMIT 10
  `).all();
  
  for (const order of orders || []) {
    try {
      results.processed++;
      
      const name = order.customer_name?.split(' ')[0] || 'there';
      const items = JSON.parse(order.items);
      const productName = items[0]?.name || 'your order';
      
      const message = `Hi ${name}! 💝

How are you loving your ${productName}?

We'd really appreciate your feedback! It helps us serve you better.

⭐ Rate your experience:`;
      
      const buttons = [
        { id: `review_5_${order.order_id}`, title: '⭐⭐⭐⭐⭐ Loved it!' },
        { id: `review_4_${order.order_id}`, title: '⭐⭐⭐⭐ Good' },
        { id: `review_issue_${order.order_id}`, title: '😕 Had issues' },
      ];
      
      const result = await sendButtons(order.phone, message, buttons, env);
      
      if (result.success) {
        results.sent++;
        
        await env.DB.prepare(`
          UPDATE orders SET review_sent = 1 WHERE order_id = ?
        `).bind(order.order_id).run();
      }
      
      await sleep(200);
      
    } catch (error) {
      results.errors++;
    }
  }
}

// ═════════════════════════════════════════════════════════════════
// REORDER SUGGESTIONS
// ═════════════════════════════════════════════════════════════════

async function processReorderSuggestions(env, results) {
  // Get customers who haven't ordered in 30 days but were active
  const { results: customers } = await env.DB.prepare(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM orders WHERE phone = c.phone AND status = 'delivered') as delivered_count
    FROM customers c
    WHERE c.opted_in = 1
    AND c.order_count >= 2
    AND c.last_order_at < datetime('now', '-30 days')
    AND c.last_order_at > datetime('now', '-60 days')
    AND c.last_seen > datetime('now', '-14 days')
    LIMIT 10
  `).all();
  
  for (const customer of customers || []) {
    try {
      results.processed++;
      
      // Check if we already sent a reorder message recently
      const recentMessage = await env.DB.prepare(`
        SELECT id FROM analytics 
        WHERE event_type = 'engagement' AND event_name = 'reorder_suggestion'
        AND phone = ? AND created_at > datetime('now', '-14 days')
      `).bind(customer.phone).first();
      
      if (recentMessage) continue;
      
      const name = customer.name?.split(' ')[0] || 'there';
      
      const message = `Hey ${name}! 👋

We miss you! It's been a while since your last order.

✨ Check out our new arrivals - we think you'll love them!

Use code *COMEBACK10* for 10% off your next order 🎁`;
      
      const buttons = [
        { id: 'shop_now', title: '🛍️ Shop Now' },
        { id: 'cat_new', title: '🆕 New Arrivals' },
      ];
      
      const result = await sendButtons(customer.phone, message, buttons, env);
      
      if (result.success) {
        results.sent++;
        
        await env.DB.prepare(`
          INSERT INTO analytics (event_type, event_name, phone, created_at)
          VALUES ('engagement', 'reorder_suggestion', ?, datetime('now'))
        `).bind(customer.phone).run();
      }
      
      await sleep(200);
      
    } catch (error) {
      results.errors++;
    }
  }
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function getTimeRemaining(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;
  
  if (diff <= 0) return 'soon';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}