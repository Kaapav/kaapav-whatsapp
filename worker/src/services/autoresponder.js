// worker/src/services/autoresponder.js
/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV Advanced Auto Responder
 * Enhanced with features from buttonHandler.js + sendMessage.js
 * 
 * Features:
 * - Message queue for sequential processing
 * - Timeout protection
 * - Enhanced error handling with fallbacks
 * - Socket.io integration for real-time dashboard
 * - Telemetry (optional Google Sheets + n8n webhooks)
 * - Rate limiting with feedback
 * - Translation support
 * - Order inquiry handling
 * - WhatsApp catalog order processing
 * ═══════════════════════════════════════════════════════════════
 */

import { WhatsAppService } from './whatsapp';
import { MenuService } from './menus';
import { ID_MAP, KEYWORDS, getConfig } from '../config';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const RATE_LIMIT_MS = 900;
const MESSAGE_TIMEOUT_MS = 5000;
const DEDUPE_TTL = 3600; // 1 hour
const RATE_LIMIT_TTL = 60; // 1 minute

// ═══════════════════════════════════════════════════════════════
// ADVANCED AUTO RESPONDER CLASS
// ═══════════════════════════════════════════════════════════════

export class AutoResponder {
  constructor(env) {
    this.env = env;
    this.wa = new WhatsAppService(env);
    this.menus = new MenuService(env);
    this.config = getConfig(env);
    
    // Message queue for sequential processing (per user)
    this.messageQueue = new Map(); // phone -> Promise
    
    // In-memory deduplication (backup to KV)
    this.seenMessages = new Set();
    this.maxSeenSize = 5000;
    
    // Socket.io instance (optional, for real-time dashboard)
    this.io = null;
    
    // Translation service (optional)
    this.translator = null;
    
    // Telemetry flags
    this.sheetsEnabled = env.SHEETS_ENABLED === '1';
    this.n8nWebhookUrl = env.N8N_WEBHOOK_URL;
    this.sheetsClient = null;
  }

  /**
   * Set Socket.io instance for real-time events
   */
  setSocket(io) {
    this.io = io;
    console.log('✅ Socket.io connected to AutoResponder');
  }

  /**
   * Set translation service
   */
  setTranslator(translator) {
    this.translator = translator;
    console.log('✅ Translator connected to AutoResponder');
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Main entry - process incoming message with queue
   * Called from webhook handler
   */
  async process({ phone, message, content, customer, chat, isFirstMessage }) {
    const messageId = message.id;
    const messageType = message.type;

    console.log(`🤖 AutoResponder: ${phone} | Type: ${messageType} | ID: ${messageId}`);

    // 1. Dedupe check (in-memory + KV)
    if (await this.isDuplicate(messageId)) {
      console.log(`⏭️ Duplicate skipped: ${messageId}`);
      this.emit('message_duplicate', { phone, messageId, type: messageType });
      return false;
    }

    // 2. Emit typing indicator
    this.emit('user_typing', { phone, ts: Date.now() });

    // 3. Queue message for sequential processing per user
    return await this.queueMessage(phone, async () => {
      return await this.processMessage({
        phone,
        message,
        content,
        customer,
        chat,
        isFirstMessage,
        messageType
      });
    });
  }

  /**
   * Queue messages per user to prevent race conditions
   */
  async queueMessage(phone, handler) {
    const existing = this.messageQueue.get(phone);
    
    const task = async () => {
      if (existing) {
        try {
          await existing; // Wait for previous message
        } catch (e) {
          console.warn(`Previous message failed for ${phone}:`, e.message);
        }
      }
      return handler();
    };
    
    const promise = task();
    this.messageQueue.set(phone, promise);
    
    // Cleanup after completion
    promise.finally(() => {
      if (this.messageQueue.get(phone) === promise) {
        this.messageQueue.delete(phone);
      }
    });
    
    return promise;
  }

  /**
   * Process individual message (wrapped in queue)
   */
  async processMessage({ phone, message, content, customer, chat, isFirstMessage, messageType }) {
    // Rate limit check
    if (!await this.checkRateLimit(phone)) {
      console.log(`⏱️ Rate limited: ${phone}`);
      this.emit('router_skip_rl', { phone, messageType, ts: Date.now() });
      
      // Schedule feedback message after cooldown
      this.scheduleRateLimitFeedback(phone);
      return false;
    }

    // Get language from customer session
    const state = await this.getConversationState(phone);
const lang = state?.flow_data?.lang || customer?.language || 'en';

    try {
      // Route based on message type with timeout protection
      const result = await this.withTimeout(
        this.routeByType({
          phone,
          message,
          content,
          customer,
          chat,
          isFirstMessage,
          messageType,
          lang
        }),
        MESSAGE_TIMEOUT_MS
      );

      // Save successful interaction
      

      return result;

    } catch (error) {
      if (error.message === 'Timeout') {
        console.error(`⏱️ Message processing timeout for ${phone}`);
        this.emit('processing_timeout', { phone, messageType, ts: Date.now() });
      } else {
        console.error(`❌ AutoResponder error for ${phone}:`, error);
        this.emit('route_error', { 
          phone, 
          error: error.message, 
          stack: error.stack,
          ts: Date.now() 
        });
      }

      await this.sendFallback(phone, lang);
      return false;
    }
  }

  /**
   * Route based on message type
   */
  async routeByType({ phone, message, content, customer, isFirstMessage, messageType, lang }) {
    switch (messageType) {
      case 'interactive':
        return await this.handleInteractive(phone, message, lang);
      
      case 'text':
        return await this.handleText(phone, content.text, lang, isFirstMessage, customer);
      
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
      case 'sticker':
        return await this.handleMedia(phone, messageType, lang);
      
      case 'order':
        return await this.handleWAOrder(phone, message.order, customer);
      
      default:
        console.warn(`⚠️ Unknown message type: ${messageType}`);
        return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE TYPE HANDLERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Handle interactive (button/list) responses
   */
  async handleInteractive(phone, message, lang) {
    const interactive = message.interactive;
    let payload = '';

    if (interactive.type === 'button_reply') {
      payload = interactive.button_reply?.id || 
                interactive.button_reply?.title || '';
    } else if (interactive.type === 'list_reply') {
      payload = interactive.list_reply?.id || 
                interactive.list_reply?.row_id || '';
    }

    console.log(`🔘 Button pressed: ${payload}`);
    this.emit('button_pressed', { 
      phone, 
      id: payload, 
      type: interactive.type,
      ts: Date.now() 
    });

    // Normalize to action
    const action = this.normalizeId(payload);
    
    if (action) {
      return await this.routeAction(action, phone, lang);
    }

    // Fallback to main menu
    return await this.routeAction('MAIN_MENU', phone, lang);
  }

  /**
   * Handle text messages with translation support
   */
  async handleText(phone, text, lang, isFirstMessage, customer) {
    const original = text || '';
    const normalized = original.toLowerCase().trim();

    // Translation attempt (if translator is available)
    let translated = normalized;
    let detectedLang = lang;

    if (this.translator) {
      try {
        const result = await this.translator.toEnglish(original);
        translated = result?.translated?.toLowerCase().trim() || normalized;
        detectedLang = result?.detectedLang || lang;
        
        // Update customer language if changed
        if (detectedLang !== lang) {
          await this.updateConversationState(phone, { lang: detectedLang });
        }
      } catch (e) {
        console.warn('Translation failed:', e.message);
      }
    }

    console.log(`💬 Text: "${original}" | Translated: "${translated}" | Lang: ${detectedLang}`);
    this.emit('text_routed', { 
      phone, 
      original, 
      translated, 
      detectedLang, 
      ts: Date.now() 
    });

    // First message always gets welcome
    if (isFirstMessage) {
      console.log(`👋 First message from ${phone}`);
      return await this.routeAction('MAIN_MENU', phone, detectedLang);
    }

    // Check for order ID (KP-XXXXX or variations)
    const orderMatch = translated.match(/kp-?\d{4,}/i);
    if (orderMatch) {
      const orderId = orderMatch[0].toUpperCase().replace(/^KP-?/, 'KP-');
      return await this.handleOrderInquiry(phone, orderId, detectedLang);
    }

    // Keyword matching
    let action = null;
    for (const kw of KEYWORDS) {
      if (kw.re.test(translated)) {
        action = kw.action;
        break;
      }
    }

    if (action) {
      console.log(`🔍 Keyword matched: ${action}`);
      return await this.routeAction(action, phone, detectedLang);
    }

    // Default: show main menu
    return await this.routeAction('MAIN_MENU', phone, detectedLang);
  }

  /**
   * Handle media messages
   */
  async handleMedia(phone, mediaType, lang) {
  this.emit('media_received', { phone, type: mediaType, ts: Date.now() });

  const msg = `✅ Received your ${mediaType}. Our team will review and respond shortly.`;
  const result = await this.wa.sendText(phone, msg);

  const messageId = result?.messages?.[0]?.id;
  if (messageId) {
    await this.saveOutgoingMessage(phone, messageId, 'text', msg, null);
  }

  return true;
}

  /**
   * Handle WhatsApp catalog order
   */
  async handleWAOrder(phone, orderData, customer) {
    const items = orderData.product_items || [];
    const orderId = `KP-${Date.now().toString().slice(-8)}`;

    console.log(`🛒 New order from ${phone}: ${orderId} (${items.length} items)`);

    try {
      // Calculate total (if available)
      let total = 0;
      for (const item of items) {
        total += (item.item_price || 0) * (item.quantity || 1);
      }

      // Create order in DB
      await this.env.DB.prepare(`
        INSERT INTO orders (
          order_id, phone, customer_name, items, item_count, 
          total, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(
        orderId,
        phone,
        customer?.name || 'Guest',
        JSON.stringify(items),
        items.length,
        total,
        new Date().toISOString()
      ).run();

      // Send confirmation
      await this.wa.sendText(phone,
        `🎉 *Order Received!*\n\n` +
        `Order ID: *${orderId}*\n` +
        `Items: ${items.length}\n` +
        `Total: ₹${total}\n\n` +
        `We'll confirm your order shortly with payment details.\n\n` +
        `Track your order anytime by sending your Order ID.`
      );

      // Emit to dashboard
      this.emit('order_received', {
        phone,
        orderId,
        items: items.length,
        total,
        ts: Date.now()
      });

      // Post to n8n webhook (if configured)
      await this.postToN8n('wa_order_created', {
        orderId,
        phone,
        items,
        total,
        customer: customer?.name
      });

      return true;

    } catch (error) {
      console.error('Order creation failed:', error);
      
      await this.wa.sendText(phone,
        `⚠️ We received your order but encountered an issue saving it.\n\n` +
        `Please contact our support team for assistance.`
      );
      
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION ROUTING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Route action to appropriate handler
   */
  /**
 * Route action to appropriate handler
 */
async routeAction(action, phone, lang) {
  console.log(`🎯 Routing: ${action} → ${phone} (${lang})`);

  try {
    switch (action) {
      // ─────────────────────────────────────────────────────────
      // MENUS
      // ─────────────────────────────────────────────────────────
      case 'MAIN_MENU': {
        const result = await this.menus.sendMainMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'main', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, result?.type || 'buttons', result?.body || 'Welcome!', result?.buttons);
        }
        break;
      }

      case 'JEWELLERY_MENU': {
        const result = await this.menus.sendJewelleryMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'jewellery', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, result?.type || 'buttons', result?.body || 'Jewellery', result?.buttons);
        }
        break;
      }

      case 'OFFERS_MENU': {
        const result = await this.menus.sendOffersMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'offers', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, result?.type || 'buttons', result?.body || 'Offers', result?.buttons);
        }
        break;
      }

      case 'PAYMENT_MENU': {
        const result = await this.menus.sendPaymentMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'payment', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, result?.type || 'buttons', result?.body || 'Payment', result?.buttons);
        }
        break;
      }

      case 'CHAT_MENU': {
        const result = await this.menus.sendChatMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'chat', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, result?.type || 'buttons', result?.body || 'Chat', result?.buttons);
        }
        break;
      }

      case 'SOCIAL_MENU': {
        const result = await this.menus.sendSocialMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'social', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, result?.type || 'buttons', result?.body || 'Social', result?.buttons);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────
      // LINKS
      // ─────────────────────────────────────────────────────────
      case 'OPEN_WEBSITE': {
        const result = await this.menus.sendLink(phone, action, lang);
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', result?.body || '[Website]', null);
        }
        break;
      }

      case 'OPEN_CATALOG': {
        const result = await this.menus.sendLink(phone, action, lang);
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', result?.body || '[Catalog]', null);
        }
        break;
      }

      case 'OPEN_BESTSELLERS': {
        const result = await this.menus.sendLink(phone, action, lang);
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', result?.body || '[Bestsellers]', null);
        }
        break;
      }

      case 'PAY_NOW': {
        const result = await this.menus.sendLink(phone, action, lang);
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', result?.body || '[Pay Now]', null);
        }
        break;
      }

      case 'TRACK_ORDER': {
        const result = await this.menus.sendLink(phone, action, lang);
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', result?.body || '[Track Order]', null);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────
      // DIRECT TEXT MESSAGES
      // ─────────────────────────────────────────────────────────
      case 'CHAT_NOW': {
        const msg = `💬 Chat with our team:\n${this.config.links?.waMeChat || ''}`;
        const result = await this.wa.sendText(phone, msg);
        const msgId = result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', msg, null);
        }
        break;
      }

      case 'OPEN_FACEBOOK': {
        const msg = `📘 Follow us on Facebook:\n${this.config.links?.facebook || ''}`;
        const result = await this.wa.sendText(phone, msg);
        const msgId = result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', msg, null);
        }
        break;
      }

      case 'OPEN_INSTAGRAM': {
        const msg = `📸 Follow us on Instagram:\n${this.config.links?.instagram || ''}`;
        const result = await this.wa.sendText(phone, msg);
        const msgId = result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', msg, null);
        }
        break;
      }

      case 'SHOW_LIST': {
        const msg = `📜 Our collections are being updated.\n\nExplore:\n${this.config.links?.website || ''}`;
        const result = await this.wa.sendText(phone, msg);
        const msgId = result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'text', msg, null);
        }
        break;
      }

      // ─────────────────────────────────────────────────────────
      // DEFAULT
      // ─────────────────────────────────────────────────────────
      default: {
        console.warn(`⚠️ Unknown action: ${action}`);
        const result = await this.menus.sendMainMenu(phone, lang);
        await this.updateConversationState(phone, { current_flow: 'main', current_step: 'menu' });
        const msgId = result?.messageId || result?.messages?.[0]?.id;
        if (msgId) {
          await this.saveOutgoingMessage(phone, msgId, 'buttons', 'Main Menu', result?.buttons);
        }
        break;
      }
    }

    // Log to telemetry
    await this.logToSheets([
      new Date().toISOString(),
      'OUT',
      phone,
      'action',
      action
    ]);

    return true;

  } catch (error) {
    console.error(`❌ Route action failed: ${action}`, error);
    this.emit('route_error', { 
      phone, 
      action, 
      error: error.message,
      ts: Date.now() 
    });
    throw error;
  }
}

        
  // ═══════════════════════════════════════════════════════════════
  // ORDER INQUIRY HANDLER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Handle order status inquiry
   */
  async handleOrderInquiry(phone, orderId, lang) {
    console.log(`📦 Order inquiry: ${orderId} from ${phone}`);

    try {
      const order = await this.env.DB.prepare(
        'SELECT * FROM orders WHERE order_id = ?'
      ).bind(orderId).first();

      if (!order) {
        await this.wa.sendText(phone,
          `❌ *Order Not Found*\n\n` +
          `Order ID: ${orderId}\n\n` +
          `Please check the Order ID and try again.\n` +
          `Format: KP-XXXXX`
        );
        
        this.emit('order_not_found', { phone, orderId, ts: Date.now() });
        return true;
      }

      // Status emoji mapping
      const statusEmoji = {
        pending: '⏳',
        confirmed: '✅',
        processing: '⚙️',
        shipped: '🚚',
        delivered: '📦',
        cancelled: '❌'
      };

      // Build status message
      let message = `📦 *Order Status*\n\n` +
        `Order ID: *${order.order_id}*\n` +
        `Status: ${statusEmoji[order.status] || '📋'} ${order.status?.toUpperCase()}\n` +
        `Date: ${new Date(order.created_at).toLocaleDateString()}\n`;

      if (order.total) {
        message += `Total: ₹${order.total}\n`;
      }

      if (order.item_count) {
        message += `Items: ${order.item_count}\n`;
      }

      // Add tracking info if available
      if (order.tracking_id) {
        message += `\n🚚 *Tracking Information*\n`;
        message += `Tracking ID: ${order.tracking_id}\n`;
        
        if (order.courier) {
          message += `Courier: ${order.courier}\n`;
        }
        
        message += `\nTrack your order:\n${this.config.links.shiprocket}`;
      } else if (order.status === 'pending' || order.status === 'confirmed') {
        message += `\n⏳ Your order will be shipped soon.\n` +
                  `You'll receive tracking details once dispatched.`;
      }

      await this.wa.sendText(phone, message);
      
      this.emit('order_inquiry', { 
        phone, 
        orderId, 
        status: order.status,
        ts: Date.now() 
      });

      return true;

    } catch (error) {
      console.error('Order inquiry failed:', error);
      
      await this.wa.sendText(phone,
        `⚠️ Unable to fetch order details right now.\n\n` +
        `Please try again in a moment or contact our support team.`
      );
      
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Normalize button ID to canonical action
   */
  normalizeId(str) {
    const key = String(str || '').trim().toLowerCase();
    if (!key) return '';
    
    // Direct match
    if (ID_MAP[key]) return ID_MAP[key];
    
    // Alphanumeric only match
    const alnum = key.replace(/[^a-z0-9_]/g, '');
    if (ID_MAP[alnum]) return ID_MAP[alnum];
    
    return '';
  }

  /**
   * Timeout wrapper for promises
   */
  async withTimeout(promise, ms = MESSAGE_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ]);
  }

  // ═══════════════════════════════════════════════════════════════
  // DEDUPLICATION & RATE LIMITING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check duplicate using in-memory Set + KV backup
   */
  async isDuplicate(messageId) {
    if (!messageId) return false;
    
    // In-memory check (fast)
    if (this.seenMessages.has(messageId)) {
      return true;
    }
    
    // KV check (persistent)
    const key = `seen:${messageId}`;
    const exists = await this.env.KV.get(key);
    
    if (exists) {
      this.seenMessages.add(messageId);
      return true;
    }
    
    // Mark as seen
    this.seenMessages.add(messageId);
    await this.env.KV.put(key, '1', { expirationTtl: DEDUPE_TTL });
    
    // Cleanup in-memory set if too large
    if (this.seenMessages.size > this.maxSeenSize) {
      const arr = Array.from(this.seenMessages);
      this.seenMessages.clear();
      // Keep last half
      for (let i = Math.floor(arr.length / 2); i < arr.length; i++) {
        this.seenMessages.add(arr[i]);
      }
    }
    
    return false;
  }

  /**
   * Rate limit check using KV
   */
  async checkRateLimit(phone) {
    const key = `rl:${phone}`;
    const lastSend = await this.env.KV.get(key);
    
    if (lastSend) {
      const elapsed = Date.now() - parseInt(lastSend);
      if (elapsed < RATE_LIMIT_MS) {
        return false;
      }
    }
    
    await this.env.KV.put(key, Date.now().toString(), { 
      expirationTtl: RATE_LIMIT_TTL 
    });
    
    return true;
  }

  /**
   * Schedule rate limit feedback message
   */
  scheduleRateLimitFeedback(phone) {
    setTimeout(async () => {
      // Check if we can send now
      const canSend = await this.checkRateLimit(phone);
      if (canSend) {
        try {
          await this.wa.sendText(phone,
            "⏱️ Please wait a moment between messages.\n\n" +
            "We're here to help - just give us a second to respond!"
          );
        } catch (e) {
          console.warn('Rate limit feedback failed:', e.message);
        }
      }
    }, RATE_LIMIT_MS + 100);
  }

  // ═══════════════════════════════════════════════════════════════
  // DATABASE OPERATIONS
  // ═══════════════════════════════════════════════════════════════
   
   /**
 * Get conversation state from conversation_state table
 * NEW FUNCTION
 */
async getConversationState(phone) {
  try {
    const state = await this.env.DB.prepare(
      'SELECT * FROM conversation_state WHERE phone = ?'
    ).bind(phone).first();

    if (state?.flow_data) {
      try {
        state.flow_data = JSON.parse(state.flow_data);
      } catch (e) {
        state.flow_data = {};
      }
    }

    return state;
  } catch (e) {
    console.warn('Get conversation state failed:', e.message);
    return null;
  }
}

  /**
   * Update customer session data
   */
  async updateConversationState(phone, data) {
  try {
    const now = new Date().toISOString();
    const existing = await this.getConversationState(phone);

    if (existing) {
      // Merge flow_data
      let flowData = existing.flow_data || {};
      if (data.flow_data) {
        flowData = { ...flowData, ...data.flow_data };
      }
      if (data.lang) {
        flowData.lang = data.lang;
      }

      await this.env.DB.prepare(`
        UPDATE conversation_state SET
          current_flow = COALESCE(?, current_flow),
          current_step = COALESCE(?, current_step),
          flow_data = ?,
          updated_at = ?
        WHERE phone = ?
      `).bind(
        data.current_flow || null,
        data.current_step || null,
        JSON.stringify(flowData),
        now,
        phone
      ).run();
    } else {
      // Insert new state
      const flowData = data.flow_data || {};
      if (data.lang) {
        flowData.lang = data.lang;
      }

      await this.env.DB.prepare(`
        INSERT INTO conversation_state (
          phone, current_flow, current_step, flow_data,
          started_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        phone,
        data.current_flow || 'main',
        data.current_step || 'start',
        JSON.stringify(flowData),
        now,
        now
      ).run();
    }

  } catch (e) {
    console.warn('Update conversation state failed:', e.message);
  }
}

  /**
   * Save outgoing message to DB
   */
 async saveOutgoingMessage(phone, messageId, messageType, body, buttons = null) {
  try {
    const now = new Date().toISOString();
    
    const safeMessageId = messageId || `auto_${Date.now()}`;
    const safeBody = String(body || '').slice(0, 4000);
    const safeType = messageType === 'interactive' ? 'buttons' : (messageType || 'text');
    
    let buttonId = null;
    let buttonText = null;
    
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      buttonId = String(buttons[0]?.id || '');
      buttonText = buttons.map(b => String(b?.title || b?.text || '')).filter(Boolean).join(' | ');
    }

    // FIXED: 22 columns matching schema exactly
    await this.env.DB.prepare(`
      INSERT INTO messages (
        message_id, phone, text, message_type, direction,
        media_id, media_url, media_mime, media_caption,
        button_id, button_text, list_id, list_title,
        context_message_id, is_forwarded,
        status, is_auto_reply, is_template, template_name,
        timestamp, delivered_at, read_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      safeMessageId,  // message_id
      phone,          // phone
      safeBody,       // text
      safeType,       // message_type
      'outgoing',     // direction
      null,           // media_id
      null,           // media_url
      null,           // media_mime
      null,           // media_caption
      buttonId,       // button_id
      buttonText,     // button_text
      null,           // list_id
      null,           // list_title
      null,           // context_message_id
      0,              // is_forwarded
      'sent',         // status
      1,              // is_auto_reply
      0,              // is_template
      null,           // template_name
      now,            // timestamp
      null,           // delivered_at
      null,           // read_at
      now             // created_at
    ).run();

    await this.updateChatOnOutgoing(phone, safeBody, safeType);
    console.log(`💾 Saved: ${safeMessageId} (type: ${safeType})`);

  } catch (e) {
    console.error('❌ saveOutgoingMessage failed:', e.message);
  }
}

   async updateChatOnOutgoing(phone, lastMessage, messageType) {
  try {
    const now = new Date().toISOString();

    await this.env.DB.prepare(`
      UPDATE chats SET
        last_message = ?,
        last_message_type = ?,
        last_timestamp = ?,
        last_direction = 'outgoing',
        total_messages = total_messages + 1,
        updated_at = ?
      WHERE phone = ?
    `).bind(
      lastMessage?.slice(0, 500),
      messageType,
      now,
      now,
      phone
    ).run();

  } catch (e) {
    console.warn('updateChatOnOutgoing failed:', e.message);
  }
}

  // ═══════════════════════════════════════════════════════════════
  // TELEMETRY & LOGGING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Emit event to Socket.io (real-time dashboard)
   */
  emit(event, payload) {
    try {
      if (this.io) {
        this.io.emit(event, payload);
        this.io.to('admins').emit(event, payload);
      }
    } catch (e) {
      console.warn(`Emit failed for ${event}:`, e.message);
    }
  }

  /**
   * Emit outgoing message event
   */
  emitOutgoing(phone, type, action) {
    this.emit('outgoing_message', {
      to: phone,
      type,
      action,
      direction: 'out',
      autoresponder: true,
      ts: Date.now()
    });
  }

  /**
   * Initialize Google Sheets client
   */
  async initSheetsClient() {
    if (!this.sheetsEnabled) return;
    if (this.sheetsClient) return;

    try {
      const { google } = await import('googleapis');
      
      const jwt = new google.auth.JWT({
        email: this.env.GOOGLE_CLIENT_EMAIL,
        key: this.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      await jwt.authorize();
      this.sheetsClient = google.sheets({ version: 'v4', auth: jwt });
      
      console.log('✅ Google Sheets client initialized');
    } catch (e) {
      console.warn('Sheets init failed:', e.message);
    }
  }

  /**
   * Log to Google Sheets (optional telemetry)
   */
  async logToSheets(values) {
    if (!this.sheetsEnabled) return;

    try {
      await this.initSheetsClient();
      if (!this.sheetsClient) return;

      const sheetId = this.env.GOOGLE_SHEET_ID;
      const sheetTab = this.env.GOOGLE_SHEET_TAB || 'WhatsAppLogs';

      await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetTab}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      });
    } catch (e) {
      console.warn('Sheets logging failed:', e.message);
    }
  }

  /**
   * Post to n8n webhook (optional telemetry)
   */
  async postToN8n(event, payload) {
    if (!this.n8nWebhookUrl) return;

    try {
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          payload,
          ts: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      console.warn('n8n webhook failed:', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FALLBACK & ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send fallback message on error
   */
  async sendFallback(phone, lang) {
    try {
      await this.wa.sendText(phone,
        "⚠️ Something went wrong on our end.\n\n" +
        "Please try again or type 'menu' to start over.\n\n" +
        "If the issue persists, our team will assist you shortly."
      );
    } catch (e) {
      console.error('Fallback message failed:', e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export default AutoResponder;
