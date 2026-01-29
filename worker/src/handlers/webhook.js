/**
 * WhatsApp Webhook Handler - Complete Implementation
 */

import { sendText, sendButtons, sendList, sendTemplate, sendImage } from '../services/whatsapp.js';
import { handleOrderFlow } from '../flows/orderFlow.js';
import { handleCatalogFlow } from '../flows/catalogFlow.js';

// ════════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION
// ════════════════════════════════════════════════════════════════

export function handleWebhookVerify(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Verified');
    return new Response(challenge);
  }
  
  return new Response('Forbidden', { status: 403 });
}

// ════════════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ════════════════════════════════════════════════════════════════

export async function handleWebhook(request, env) {
  try {
    const body = await request.json();
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return;

    // Handle Status Updates
    if (value.statuses) {
      await handleStatusUpdate(value.statuses, env);
      return;
    }

    // Handle Messages
    const messages = value.messages;
    if (!messages?.length) return;

    const contact = value.contacts?.[0];
    const message = messages[0];
    const phone = message.from;
    const name = contact?.profile?.name || '';

    console.log(`[Webhook] Message from ${phone}: ${message.type}`);

    // Ensure customer exists
    await ensureCustomer(phone, name, env);
    
    // Save incoming message
    await saveMessage(phone, message, env);
    
    // Update chat
    await updateChat(phone, name, message, env);

    // Process message
    await processMessage(phone, message, env);

  } catch (error) {
    console.error('[Webhook] Error:', error.message);
  }
}

// ════════════════════════════════════════════════════════════════
// MESSAGE PROCESSOR
// ════════════════════════════════════════════════════════════════

async function processMessage(phone, message, env) {
  let text = '';
  let buttonId = null;
  let listId = null;

  // Extract content based on type
  switch (message.type) {
    case 'text':
      text = message.text?.body || '';
      break;
    
    case 'interactive':
      if (message.interactive?.type === 'button_reply') {
        buttonId = message.interactive.button_reply?.id;
        text = message.interactive.button_reply?.title || '';
      } else if (message.interactive?.type === 'list_reply') {
        listId = message.interactive.list_reply?.id;
        text = message.interactive.list_reply?.title || '';
      }
      break;
    
    case 'button':
      buttonId = message.button?.payload;
      text = message.button?.text || '';
      break;
    
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      text = message[message.type]?.caption || `[${message.type}]`;
      // Save media
      await saveMedia(phone, message, env);
      break;
    
    case 'location':
      await handleLocation(phone, message.location, env);
      return;
    
    case 'order':
      // WhatsApp Catalog Order
      await handleCatalogOrder(phone, message.order, env);
      return;
  }

  // Handle button/list clicks
  if (buttonId || listId) {
    await handleInteractiveResponse(phone, buttonId || listId, text, env);
    return;
  }

  // Check conversation state
  const state = await getState(phone, env);
  if (state?.current_flow) {
    await handleFlowStep(phone, text, state, env);
    return;
  }

  // Check quick replies
  const quickReply = await matchQuickReply(text, env);
  if (quickReply) {
    await sendQuickReply(phone, quickReply, env);
    return;
  }

  // Keyword handling
  const lower = text.toLowerCase().trim();
  
  // Greetings
  if (['hi', 'hello', 'hey', 'hii', 'start'].includes(lower)) {
    await sendWelcome(phone, env);
    return;
  }

  // Menu
  if (['menu', 'help', 'options'].includes(lower)) {
    await sendMainMenu(phone, env);
    return;
  }

  // Catalog
  if (lower.includes('catalog') || lower.includes('product') || lower.includes('collection') || lower === 'shop') {
    await handleCatalogFlow(phone, 'start', {}, env);
    return;
  }

  // Order
  if (lower.includes('order') || lower.includes('buy') || lower.includes('purchase')) {
    await handleOrderFlow(phone, 'start', {}, env);
    return;
  }

  // Track Order
  if (lower.includes('track') || lower.includes('status') || lower.includes('where')) {
    await sendOrderStatus(phone, env);
    return;
  }

  // Cart
  if (lower === 'cart' || lower.includes('my cart')) {
    await sendCart(phone, env);
    return;
  }

  // Price
  if (lower.includes('price') || lower.includes('cost') || lower.includes('rate')) {
    await sendPriceInquiry(phone, env);
    return;
  }

  // COD
  if (lower.includes('cod') || lower.includes('cash on delivery')) {
    await sendText(phone, "Yes! We offer Cash on Delivery. 📦\n\nFree COD on orders above ₹499.\n\nWould you like to place an order?", env);
    return;
  }

  // Return
  if (lower.includes('return') || lower.includes('refund') || lower.includes('exchange')) {
    await sendText(phone, "🔄 *Return Policy*\n\nWe offer 7-day easy returns.\n• No questions asked\n• Free pickup\n• Refund within 5-7 days\n\nFor returns, please share your Order ID.", env);
    return;
  }

  // Default - AI or fallback
  await handleUnknownMessage(phone, text, env);
}

// ════════════════════════════════════════════════════════════════
// WELCOME & MENU
// ════════════════════════════════════════════════════════════════

async function sendWelcome(phone, env) {
  const customer = await env.DB.prepare(`SELECT * FROM customers WHERE phone = ?`).bind(phone).first();
  const name = customer?.name ? customer.name.split(' ')[0] : '';
  
  const greeting = name ? `Hello ${name}! 👋` : 'Hello! 👋';
  
  const message = `${greeting}

Welcome to *KAAPAV Fashion Jewellery* ✨

India's finest collection of trendy, affordable jewellery.

🌟 *New Arrivals* - Just launched!
💎 *Best Sellers* - Customer favorites
🔥 *Offers* - Up to 50% OFF

How can I help you today?`;

  const buttons = [
    { id: 'shop_now', title: '🛍️ Shop Now' },
    { id: 'track_order', title: '📦 Track Order' },
    { id: 'talk_support', title: '💬 Talk to Us' }
  ];

  await sendButtons(phone, message, buttons, env);
  
  // Log analytics
  await logEvent('welcome_sent', phone, env);
}

async function sendMainMenu(phone, env) {
  const message = `*KAAPAV Menu* 📋

How can I help you?`;

  const sections = [
    {
      title: 'Shop',
      rows: [
        { id: 'cat_earrings', title: '👂 Earrings', description: 'Jhumkas, Studs, Drops' },
        { id: 'cat_necklaces', title: '📿 Necklaces', description: 'Chains, Pendants, Sets' },
        { id: 'cat_bracelets', title: '⌚ Bracelets', description: 'Bangles, Chains, Cuffs' },
        { id: 'cat_rings', title: '💍 Rings', description: 'Bands, Statement, Sets' },
        { id: 'cat_all', title: '✨ All Products', description: 'Browse full catalog' }
      ]
    },
    {
      title: 'Orders & Support',
      rows: [
        { id: 'my_orders', title: '📦 My Orders', description: 'Track & view orders' },
        { id: 'my_cart', title: '🛒 My Cart', description: 'View cart items' },
        { id: 'talk_support', title: '💬 Support', description: 'Chat with us' }
      ]
    }
  ];

  await sendList(phone, message, 'View Options', sections, env);
}

// ════════════════════════════════════════════════════════════════
// INTERACTIVE RESPONSE HANDLER
// ════════════════════════════════════════════════════════════════

async function handleInteractiveResponse(phone, id, text, env) {
  console.log(`[Interactive] ${phone} clicked: ${id}`);

  // Shop buttons
  if (id === 'shop_now') {
    await handleCatalogFlow(phone, 'start', {}, env);
    return;
  }

  // Categories
  if (id.startsWith('cat_')) {
    const category = id.replace('cat_', '');
    await handleCatalogFlow(phone, 'category', { category }, env);
    return;
  }

  // Products
  if (id.startsWith('prod_')) {
    const sku = id.replace('prod_', '');
    await handleCatalogFlow(phone, 'product', { sku }, env);
    return;
  }

  // Add to cart
  if (id.startsWith('add_')) {
    const sku = id.replace('add_', '');
    await addToCart(phone, sku, 1, env);
    return;
  }

  // Buy now
  if (id.startsWith('buy_')) {
    const sku = id.replace('buy_', '');
    await addToCart(phone, sku, 1, env);
    await handleOrderFlow(phone, 'start', {}, env);
    return;
  }

  // Cart
  if (id === 'my_cart' || id === 'view_cart') {
    await sendCart(phone, env);
    return;
  }

  // Checkout
  if (id === 'checkout' || id === 'place_order') {
    await handleOrderFlow(phone, 'start', {}, env);
    return;
  }

  // Orders
  if (id === 'track_order' || id === 'my_orders') {
    await sendOrderStatus(phone, env);
    return;
  }

  // Order actions
  if (id.startsWith('order_')) {
    const [, action, orderId] = id.split('_');
    await handleOrderAction(phone, action, orderId, env);
    return;
  }

  // Payment
  if (id.startsWith('pay_')) {
    const method = id.replace('pay_', '');
    await handlePaymentSelection(phone, method, env);
    return;
  }

  // Address confirmation
  if (id === 'confirm_address') {
    await handleOrderFlow(phone, 'confirm_address', {}, env);
    return;
  }

  if (id === 'change_address') {
    await handleOrderFlow(phone, 'collect_address', {}, env);
    return;
  }

  // Support
  if (id === 'talk_support') {
    await connectToAgent(phone, env);
    return;
  }

  // Default
  await sendText(phone, "I didn't understand that. Type 'menu' for options.", env);
}

// ════════════════════════════════════════════════════════════════
// CART FUNCTIONS
// ════════════════════════════════════════════════════════════════

async function addToCart(phone, sku, quantity, env) {
  // Get product
  const product = await env.DB.prepare(`SELECT * FROM products WHERE sku = ? AND is_active = 1`).bind(sku).first();
  
  if (!product) {
    await sendText(phone, "Sorry, this product is not available.", env);
    return;
  }

  if (product.stock < quantity) {
    await sendText(phone, `Sorry, only ${product.stock} items available.`, env);
    return;
  }

  // Get or create cart
  let cart = await env.DB.prepare(`SELECT * FROM carts WHERE phone = ?`).bind(phone).first();
  let items = cart ? JSON.parse(cart.items || '[]') : [];

  // Check if already in cart
  const existingIndex = items.findIndex(i => i.sku === sku);
  if (existingIndex >= 0) {
    items[existingIndex].quantity += quantity;
  } else {
    items.push({
      sku: product.sku,
      name: product.name,
      price: product.price,
      image: product.image_url,
      quantity
    });
  }

  const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  // Save cart
  await env.DB.prepare(`
    INSERT INTO carts (phone, items, item_count, total, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(phone) DO UPDATE SET items = ?, item_count = ?, total = ?, updated_at = datetime('now'), status = 'active'
  `).bind(phone, JSON.stringify(items), items.length, total, JSON.stringify(items), items.length, total).run();

  // Also update customer cart
  await env.DB.prepare(`
    UPDATE customers SET cart = ?, cart_updated_at = datetime('now') WHERE phone = ?
  `).bind(JSON.stringify(items), phone).run();

  const message = `✅ *Added to Cart!*

${product.name}
₹${product.price} × ${quantity}

🛒 *Cart Total:* ₹${total} (${items.length} items)`;

  const buttons = [
    { id: 'view_cart', title: '🛒 View Cart' },
    { id: 'checkout', title: '✅ Checkout' },
    { id: 'shop_now', title: '🛍️ Continue' }
  ];

  await sendButtons(phone, message, buttons, env);
  
  await logEvent('add_to_cart', phone, env, { sku, quantity, total });
}

async function sendCart(phone, env) {
  const cart = await env.DB.prepare(`SELECT * FROM carts WHERE phone = ? AND status = 'active'`).bind(phone).first();
  
  if (!cart || !cart.items || cart.item_count === 0) {
    const message = "Your cart is empty! 🛒\n\nBrowse our collection and add items.";
    const buttons = [{ id: 'shop_now', title: '🛍️ Shop Now' }];
    await sendButtons(phone, message, buttons, env);
    return;
  }

  const items = JSON.parse(cart.items);
  let message = "🛒 *Your Cart*\n\n";
  
  items.forEach((item, i) => {
    message += `${i + 1}. ${item.name}\n`;
    message += `   ₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}\n\n`;
  });

  message += `─────────────\n`;
  message += `*Total: ₹${cart.total}*`;

  const buttons = [
    { id: 'checkout', title: '✅ Checkout' },
    { id: 'shop_now', title: '🛍️ Add More' }
  ];

  await sendButtons(phone, message, buttons, env);
}

// ════════════════════════════════════════════════════════════════
// ORDER STATUS
// ════════════════════════════════════════════════════════════════

async function sendOrderStatus(phone, env) {
  const { results: orders } = await env.DB.prepare(`
    SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 5
  `).bind(phone).all();

  if (!orders?.length) {
    const message = "You don't have any orders yet.\n\nReady to shop?";
    const buttons = [{ id: 'shop_now', title: '🛍️ Shop Now' }];
    await sendButtons(phone, message, buttons, env);
    return;
  }

  let message = "📦 *Your Orders*\n\n";

  const statusEmoji = {
    pending: '🟡',
    confirmed: '🟢',
    processing: '🔵',
    shipped: '🚚',
    delivered: '✅',
    cancelled: '❌'
  };

  orders.forEach(order => {
    const emoji = statusEmoji[order.status] || '⚪';
    message += `${emoji} *${order.order_id}*\n`;
    message += `   ${order.status.toUpperCase()} • ₹${order.total}\n`;
    if (order.tracking_id) {
      message += `   📍 Track: ${order.tracking_id}\n`;
    }
    message += `   ${formatDate(order.created_at)}\n\n`;
  });

  // Show tracking button for shipped orders
  const shippedOrder = orders.find(o => o.status === 'shipped' && o.tracking_url);
  
  if (shippedOrder) {
    const buttons = [
      { id: `order_track_${shippedOrder.order_id}`, title: '📍 Track Shipment' },
      { id: 'shop_now', title: '🛍️ Shop More' }
    ];
    await sendButtons(phone, message, buttons, env);
  } else {
    await sendText(phone, message, env);
  }
}

// ════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

async function ensureCustomer(phone, name, env) {
  const existing = await env.DB.prepare(`SELECT phone FROM customers WHERE phone = ?`).bind(phone).first();
  
  if (existing) {
    await env.DB.prepare(`
      UPDATE customers SET 
        name = COALESCE(NULLIF(?, ''), name),
        message_count = message_count + 1,
        last_seen = datetime('now'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(name, phone).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO customers (phone, name, first_seen, last_seen, created_at)
      VALUES (?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).bind(phone, name).run();
    
    await logEvent('new_customer', phone, env);
  }
}

async function saveMessage(phone, message, env) {
  let text = '';
  let mediaId = null;
  let mediaUrl = null;

  switch (message.type) {
    case 'text':
      text = message.text?.body || '';
      break;
    case 'interactive':
      text = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
      break;
    case 'button':
      text = message.button?.text || '';
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      text = message[message.type]?.caption || `[${message.type}]`;
      mediaId = message[message.type]?.id;
      break;
    default:
      text = `[${message.type}]`;
  }

  await env.DB.prepare(`
    INSERT INTO messages (message_id, phone, text, message_type, direction, media_id, timestamp, created_at)
    VALUES (?, ?, ?, ?, 'incoming', ?, datetime('now'), datetime('now'))
  `).bind(message.id, phone, text.slice(0, 4000), message.type, mediaId).run();
}

async function updateChat(phone, name, message, env) {
  let text = message.text?.body || message.interactive?.button_reply?.title || `[${message.type}]`;
  
  await env.DB.prepare(`
    INSERT INTO chats (phone, customer_name, last_message, last_message_type, last_timestamp, last_direction, unread_count, total_messages, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), 'incoming', 1, 1, datetime('now'), datetime('now'))
    ON CONFLICT(phone) DO UPDATE SET
      customer_name = COALESCE(NULLIF(?, ''), customer_name),
      last_message = ?,
      last_message_type = ?,
      last_timestamp = datetime('now'),
      last_direction = 'incoming',
      unread_count = unread_count + 1,
      total_messages = total_messages + 1,
      updated_at = datetime('now')
  `).bind(phone, name, text.slice(0, 500), message.type, name, text.slice(0, 500), message.type).run();
}

async function getState(phone, env) {
  return await env.DB.prepare(`
    SELECT * FROM conversation_state 
    WHERE phone = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
  `).bind(phone).first();
}

async function setState(phone, flow, step, data, env) {
  await env.DB.prepare(`
    INSERT INTO conversation_state (phone, current_flow, current_step, flow_data, updated_at, expires_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+1 hour'))
    ON CONFLICT(phone) DO UPDATE SET current_flow = ?, current_step = ?, flow_data = ?, updated_at = datetime('now')
  `).bind(phone, flow, step, JSON.stringify(data), flow, step, JSON.stringify(data)).run();
}

async function clearState(phone, env) {
  await env.DB.prepare(`DELETE FROM conversation_state WHERE phone = ?`).bind(phone).run();
}

async function matchQuickReply(text, env) {
  const lower = text.toLowerCase().trim();
  
  // Exact match
  let reply = await env.DB.prepare(`
    SELECT * FROM quick_replies WHERE is_active = 1 AND LOWER(shortcut) = ?
  `).bind(lower).first();
  
  if (reply) return reply;
  
  // Contains match
  const { results } = await env.DB.prepare(`
    SELECT * FROM quick_replies WHERE is_active = 1
  `).all();
  
  for (const r of results) {
    if (lower.includes(r.shortcut.toLowerCase())) {
      return r;
    }
  }
  
  return null;
}

async function sendQuickReply(phone, reply, env) {
  // Update usage count
  await env.DB.prepare(`UPDATE quick_replies SET use_count = use_count + 1 WHERE id = ?`).bind(reply.id).run();
  
  if (reply.message_type === 'buttons' && reply.buttons) {
    const buttons = JSON.parse(reply.buttons);
    await sendButtons(phone, reply.message, buttons, env);
  } else {
    await sendText(phone, reply.message, env);
  }
  
  // Save outgoing message
  await saveOutgoing(phone, reply.message, env, true);
}

async function connectToAgent(phone, env) {
  await env.DB.prepare(`
    UPDATE chats SET is_bot_enabled = 0, status = 'pending', priority = 'high', updated_at = datetime('now')
    WHERE phone = ?
  `).bind(phone).run();

  await sendText(phone, "👋 Connecting you to our team...\n\nWe'll respond shortly. You can continue chatting.", env);
  
  // TODO: Send push notification to agents
  await logEvent('agent_requested', phone, env);
}

async function handleUnknownMessage(phone, text, env) {
  // TODO: Add AI processing here
  
  const message = `I'm not sure I understood that. 🤔

Here's what I can help with:

• Type *shop* - Browse products
• Type *cart* - View your cart  
• Type *order* - Place an order
• Type *track* - Track your order
• Type *menu* - See all options

Or type *support* to chat with our team.`;

  await sendText(phone, message, env);
}

async function saveOutgoing(phone, text, env, isAuto = false) {
  await env.DB.prepare(`
    INSERT INTO messages (phone, text, direction, message_type, is_auto_reply, timestamp, created_at)
    VALUES (?, ?, 'outgoing', 'text', ?, datetime('now'), datetime('now'))
  `).bind(phone, text.slice(0, 4000), isAuto ? 1 : 0).run();

  await env.DB.prepare(`
    UPDATE chats SET 
      last_message = ?, 
      last_timestamp = datetime('now'),
      last_direction = 'outgoing',
      total_messages = total_messages + 1,
      updated_at = datetime('now')
    WHERE phone = ?
  `).bind(text.slice(0, 500), phone).run();
}

async function handleStatusUpdate(statuses, env) {
  for (const status of statuses) {
    const { id: messageId, status: newStatus, recipient_id: phone } = status;
    
    await env.DB.prepare(`
      UPDATE messages SET status = ?, ${newStatus === 'delivered' ? 'delivered_at' : newStatus === 'read' ? 'read_at' : ''} = datetime('now')
      WHERE message_id = ?
    `).bind(newStatus, messageId).run().catch(() => {});
  }
}

async function logEvent(event, phone, env, data = {}) {
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, data, created_at)
    VALUES ('event', ?, ?, ?, datetime('now'))
  `).bind(event, phone, JSON.stringify(data)).run().catch(() => {});
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}