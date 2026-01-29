/**
 * ════════════════════════════════════════════════════════════════
 * ABANDONED CART RECOVERY
 * Automated cart recovery messages
 * ════════════════════════════════════════════════════════════════
 */

import { sendText, sendButtons, sendTemplate } from '../services/whatsapp.js';
import { CONFIG } from '../config.js';

// ═════════════════════════════════════════════════════════════════
// RECOVERY CONFIGURATION
// ═════════════════════════════════════════════════════════════════

const RECOVERY_CONFIG = {
  // Time after cart update to send first reminder (minutes)
  FIRST_REMINDER_DELAY: 60,
  
  // Time after first reminder for second reminder (minutes)
  SECOND_REMINDER_DELAY: 24 * 60, // 24 hours
  
  // Time after second reminder for third reminder (minutes)
  THIRD_REMINDER_DELAY: 48 * 60, // 48 hours
  
  // Maximum reminders to send
  MAX_REMINDERS: 3,
  
  // Minimum cart value for recovery
  MIN_CART_VALUE: 199,
};

// ═════════════════════════════════════════════════════════════════
// PROCESS CART RECOVERY
// ═════════════════════════════════════════════════════════════════

export async function processCartRecovery(env) {
  const results = { success: true, processed: 0, sent: 0, errors: 0 };
  
  // Get abandoned carts
  const { results: carts } = await env.DB.prepare(`
    SELECT 
      c.*,
      cu.name as customer_name,
      cu.opted_in
    FROM carts c
    JOIN customers cu ON c.phone = cu.phone
    WHERE c.status = 'active'
    AND c.item_count > 0
    AND c.total >= ?
    AND c.reminder_count < ?
    AND cu.opted_in = 1
    AND (
      (c.reminder_count = 0 AND c.updated_at < datetime('now', '-' || ? || ' minutes'))
      OR (c.reminder_count = 1 AND c.last_reminder_at < datetime('now', '-' || ? || ' minutes'))
      OR (c.reminder_count = 2 AND c.last_reminder_at < datetime('now', '-' || ? || ' minutes'))
    )
    LIMIT 50
  `).bind(
    RECOVERY_CONFIG.MIN_CART_VALUE,
    RECOVERY_CONFIG.MAX_REMINDERS,
    RECOVERY_CONFIG.FIRST_REMINDER_DELAY,
    RECOVERY_CONFIG.SECOND_REMINDER_DELAY,
    RECOVERY_CONFIG.THIRD_REMINDER_DELAY
  ).all();
  
  if (!carts?.length) {
    return results;
  }
  
  for (const cart of carts) {
    try {
      results.processed++;
      
      const items = JSON.parse(cart.items);
      const reminderNumber = cart.reminder_count + 1;
      
      // Send appropriate reminder
      const sent = await sendCartReminder(cart.phone, items, cart.total, reminderNumber, cart.customer_name, env);
      
      if (sent) {
        results.sent++;
        
        // Update cart
        await env.DB.prepare(`
          UPDATE carts SET 
            reminder_count = reminder_count + 1,
            last_reminder_at = datetime('now')
          WHERE phone = ?
        `).bind(cart.phone).run();
        
        // Log event
        await env.DB.prepare(`
          INSERT INTO analytics (event_type, event_name, phone, data, created_at)
          VALUES ('cart', 'recovery_sent', ?, ?, datetime('now'))
        `).bind(cart.phone, JSON.stringify({ reminderNumber, total: cart.total })).run();
      }
      
      // Rate limiting
      await sleep(200);
      
    } catch (error) {
      console.error(`[CartRecovery] Error for ${cart.phone}:`, error.message);
      results.errors++;
    }
  }
  
  return results;
}

// ═════════════════════════════════════════════════════════════════
// SEND CART REMINDER
// ═════════════════════════════════════════════════════════════════

async function sendCartReminder(phone, items, total, reminderNumber, customerName, env) {
  const name = customerName?.split(' ')[0] || 'there';
  
  // Different messages for each reminder
  const messages = {
    1: {
      text: `Hey ${name}! 👋

You left ${items.length} item(s) in your cart:

${formatCartItems(items)}

💰 Total: ₹${total}

Complete your order before they sell out!`,
      buttons: [
        { id: 'checkout', title: '✅ Complete Order' },
        { id: 'view_cart', title: '🛒 View Cart' },
      ],
    },
    
    2: {
      text: `Hi ${name}! 🛒

Your cart is waiting! These items are selling fast:

${formatCartItems(items)}

💰 Total: ₹${total}

🎁 Complete now and enjoy FREE shipping on orders above ₹499!`,
      buttons: [
        { id: 'checkout', title: '🛍️ Buy Now' },
        { id: 'talk_support', title: '❓ Need Help?' },
      ],
    },
    
    3: {
      text: `Last chance, ${name}! ⏰

Your cart will expire soon:

${formatCartItems(items)}

💰 Total: ₹${total}

Don't miss out on these beauties! 💎`,
      buttons: [
        { id: 'checkout', title: '⚡ Order Now' },
        { id: 'shop_now', title: '👀 Browse More' },
      ],
    },
  };
  
  const reminder = messages[reminderNumber] || messages[1];
  
  try {
    const result = await sendButtons(phone, reminder.text, reminder.buttons, env);
    return result.success;
  } catch (error) {
    console.error(`[CartRecovery] Send error:`, error.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function formatCartItems(items) {
  return items.slice(0, 3).map((item, i) => 
    `${i + 1}. ${item.name} - ₹${item.price}`
  ).join('\n') + (items.length > 3 ? `\n   +${items.length - 3} more...` : '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}