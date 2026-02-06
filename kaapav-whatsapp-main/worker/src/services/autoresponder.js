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
  async process({ phone, message, content, customer, conversation, isFirstMessage }) {
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
        conversation,
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
  async processMessage({ phone, message, content, customer, conversation, isFirstMessage, messageType }) {
    // Rate limit check
    if (!await this.checkRateLimit(phone)) {
      console.log(`⏱️ Rate limited: ${phone}`);
      this.emit('router_skip_rl', { phone, messageType, ts: Date.now() });
      
      // Schedule feedback message after cooldown
      this.scheduleRateLimitFeedback(phone);
      return false;
    }

    // Get language from customer session
    const lang = customer?.lang || 'en';

    try {
      // Route based on message type with timeout protection
      const result = await this.withTimeout(
        this.routeByType({
          phone,
          message,
          content,
          customer,
          conversation,
          isFirstMessage,
          messageType,
          lang
        }),
        MESSAGE_TIMEOUT_MS
      );

      // Save successful interaction
      await this.saveOutgoingMessage(phone, messageType, 'auto_response');

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
          await this.updateSession(phone, { lang: detectedLang });
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
    
    await this.wa.sendText(phone, 
      `✅ Received your ${mediaType}. Our team will review and respond shortly.`
    );
    
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
  async routeAction(action, phone, lang) {
    console.log(`🎯 Routing: ${action} → ${phone} (${lang})`);
    
    this.emit('route_action', { phone, action, lang, ts: Date.now() });

    try {
      switch (action) {
        // ─────────────────────────────────────────────────────────
        // MENUS
        // ─────────────────────────────────────────────────────────
        case 'MAIN_MENU':
          await this.menus.sendMainMenu(phone, lang);
          await this.updateSession(phone, { lastMenu: 'main' });
          this.emitOutgoing(phone, 'menu', 'MAIN_MENU');
          break;

        case 'JEWELLERY_MENU':
          await this.menus.sendJewelleryMenu(phone, lang);
          await this.updateSession(phone, { lastMenu: 'jewellery' });
          this.emitOutgoing(phone, 'menu', 'JEWELLERY_MENU');
          break;

        case 'OFFERS_MENU':
          await this.menus.sendOffersMenu(phone, lang);
          await this.updateSession(phone, { lastMenu: 'offers' });
          this.emitOutgoing(phone, 'menu', 'OFFERS_MENU');
          break;

        case 'PAYMENT_MENU':
          await this.menus.sendPaymentMenu(phone, lang);
          await this.updateSession(phone, { lastMenu: 'payment' });
          this.emitOutgoing(phone, 'menu', 'PAYMENT_MENU');
          break;

        case 'CHAT_MENU':
          await this.menus.sendChatMenu(phone, lang);
          await this.updateSession(phone, { lastMenu: 'chat' });
          this.emitOutgoing(phone, 'menu', 'CHAT_MENU');
          break;

        case 'SOCIAL_MENU':
          await this.menus.sendSocialMenu(phone, lang);
          await this.updateSession(phone, { lastMenu: 'social' });
          this.emitOutgoing(phone, 'menu', 'SOCIAL_MENU');
          break;

        // ─────────────────────────────────────────────────────────
        // LINK ACTIONS
        // ─────────────────────────────────────────────────────────
        case 'OPEN_WEBSITE':
          await this.menus.sendLink(phone, action, lang);
          this.emitOutgoing(phone, 'link', 'website');
          break;

        case 'OPEN_CATALOG':
          await this.menus.sendLink(phone, action, lang);
          this.emitOutgoing(phone, 'link', 'catalog');
          break;

        case 'OPEN_BESTSELLERS':
          await this.menus.sendLink(phone, action, lang);
          this.emitOutgoing(phone, 'link', 'bestsellers');
          break;

        case 'PAY_NOW':
          await this.menus.sendLink(phone, action, lang);
          this.emitOutgoing(phone, 'link', 'payment');
          break;

        case 'TRACK_ORDER':
          await this.menus.sendLink(phone, action, lang);
          this.emitOutgoing(phone, 'link', 'shiprocket');
          break;

        case 'CHAT_NOW':
          await this.wa.sendText(phone, 
            `💬 Chat with our team:\n${this.config.links.waMeChat}`
          );
          this.emitOutgoing(phone, 'link', 'chat');
          break;

        case 'OPEN_FACEBOOK':
          await this.wa.sendText(phone, 
            `📘 Follow us on Facebook:\n${this.config.links.facebook}`
          );
          this.emitOutgoing(phone, 'link', 'facebook');
          break;

        case 'OPEN_INSTAGRAM':
          await this.wa.sendText(phone, 
            `📸 Follow us on Instagram:\n${this.config.links.instagram}`
          );
          this.emitOutgoing(phone, 'link', 'instagram');
          break;

        // ─────────────────────────────────────────────────────────
        // INFORMATIONAL
        // ─────────────────────────────────────────────────────────
        case 'SHOW_LIST':
          await this.wa.sendText(phone,
            "📜 Our collections are being updated.\n\n" +
            `Meanwhile, explore our catalogue:\n${this.config.links.website}`
          );
          this.emitOutgoing(phone, 'info', 'list');
          break;

        // ─────────────────────────────────────────────────────────
        // UNKNOWN
        // ─────────────────────────────────────────────────────────
        default:
          console.warn(`⚠️ Unknown action: ${action}`);
          await this.menus.sendMainMenu(phone, lang);
          this.emitOutgoing(phone, 'menu', 'MAIN_MENU_FALLBACK');
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
      throw error; // Re-throw for outer catch
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
   * Update customer session data
   */
  async updateSession(phone, data) {
    try {
      // Get existing flow_data
      const existing = await this.env.DB.prepare(
        'SELECT flow_data FROM customers WHERE phone = ?'
      ).bind(phone).first();

      let flowData = {};
      if (existing?.flow_data) {
        try {
          flowData = JSON.parse(existing.flow_data);
        } catch (e) {
          console.warn('Failed to parse existing flow_data');
        }
      }

      // Merge new data
      flowData = { ...flowData, ...data };

      // Update
      await this.env.DB.prepare(`
        UPDATE customers 
        SET flow_data = ?, updated_at = ?
        WHERE phone = ?
      `).bind(
        JSON.stringify(flowData),
        new Date().toISOString(),
        phone
      ).run();

    } catch (e) {
      console.warn('Session update failed:', e.message);
    }
  }

  /**
   * Save outgoing message to DB
   */
  async saveOutgoingMessage(phone, type, content) {
    try {
      const conversation = await this.env.DB.prepare(
        'SELECT id FROM conversations WHERE phone = ?'
      ).bind(phone).first();

      if (conversation) {
        await this.env.DB.prepare(`
          INSERT INTO messages (
            conversation_id, phone, direction, type, content, 
            sent_at, status
          )
          VALUES (?, ?, 'outbound', ?, ?, ?, 'sent')
        `).bind(
          conversation.id,
          phone,
          type,
          typeof content === 'string' ? content : JSON.stringify(content),
          new Date().toISOString()
        ).run();
      }
    } catch (e) {
      console.warn('Message save failed:', e.message);
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
