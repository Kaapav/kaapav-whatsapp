// worker/src/handlers/webhook.js
/**
 * ═══════════════════════════════════════════════════════════════
 * WhatsApp Webhook Handler
 * Fixed to work with index.js router pattern
 * ═══════════════════════════════════════════════════════════════
 */

import { AutoResponder } from '../services/autoresponder';
import { WhatsAppService } from '../services/whatsapp';

/**
 * Verify webhook (GET from Meta)
 */
async function verify(ctx) {
  const mode = ctx.query('hub.mode');
  const token = ctx.query('hub.verify_token');
  const challenge = ctx.query('hub.challenge');

  console.log('[Webhook] Verification attempt:', { 
    mode, 
    token: token?.slice(0, 5) + '***',
    expectedToken: ctx.env.WHATSAPP_VERIFY_TOKEN?.slice(0, 5) + '***'
  });

  if (mode === 'subscribe' && token === ctx.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verified successfully');
    return ctx.text(challenge, 200);
  }

  console.log('[Webhook] ❌ Verification failed');
  return ctx.error('Forbidden', 403);
}

/**
 * Handle webhook events (POST from Meta)
 */
async function handle(ctx) {
  try {
    const body = await ctx.body();
    
    // Log for debugging (truncated)
    console.log('[Webhook] Received:', JSON.stringify(body).slice(0, 500));

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Handle status updates (delivered, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          ctx.waitUntil(handleStatusUpdates(ctx.env, value.statuses));
        }

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            ctx.waitUntil(
              handleIncomingMessage(ctx.env, message, value.contacts?.[0])
            );
          }
        }
      }
    }

    return ctx.text('OK', 200);

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return ctx.text('OK', 200); // Still return 200 to prevent Meta retries
  }
}

/**
 * Handle incoming message
 */
async function handleIncomingMessage(env, message, contact) {
  const phone = message.from;
  const messageId = message.id;
  const messageType = message.type;
  const timestamp = message.timestamp;

  console.log(`📩 Message from ${phone}: ${messageType} (ID: ${messageId})`);

  try {
    // 1. Get or create customer
    const customer = await getOrCreateCustomer(env, phone, contact);

    // 2. Get or create chat (FIXED: was getOrCreateChat)
    const chat = await getOrCreateChat(env, phone, customer?.name);

    // 3. Check if first message
    const isFirstMessage = !customer.first_seen;

    // 4. Extract content
    const content = extractContent(message);

    // 5. Save incoming message to DB (FIXED: correct column names)
    await saveMessage(env, {
      message_id: messageId,
      phone: phone,
      text: content.text || '',
      message_type: messageType,
      direction: 'incoming',
      media_id: content.media_id,
      media_caption: content.caption,
      button_id: content.button_payload,
      button_text: content.button_text,
      context_message_id: message.context?.id,
      timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
    });

    // 6. Update chat metadata (NEW)
    await updateChatOnMessage(env, phone, content.text || `[${messageType}]`, messageType, 'incoming');

    // 7. Update customer first_seen if needed (FIXED: was first_message_at)
    if (isFirstMessage) {
      await env.DB.prepare(
        'UPDATE customers SET first_seen = ?, updated_at = ? WHERE phone = ?'
      ).bind(new Date().toISOString(), new Date().toISOString(), phone).run();
    }

    // 8. Update customer last_seen (FIXED: was last_message_at)
    await env.DB.prepare(
      'UPDATE customers SET last_seen = ?, message_count = message_count + 1, updated_at = ? WHERE phone = ?'
    ).bind(new Date().toISOString(), new Date().toISOString(), phone).run();

    // 9. Process with AutoResponder (FIXED: pass chat instead of conversation)
    const autoResponder = new AutoResponder(env);
    await autoResponder.process({
      phone,
      message,
      content,
      customer,
      chat,  // FIXED: was 'conversation'
      isFirstMessage,
    });

    // 10. Mark message as read in WhatsApp
    try {
      const wa = new WhatsAppService(env);
      await wa.markAsRead(messageId);
    } catch (e) {
      console.warn('[Webhook] Mark read failed:', e.message);
    }

  } catch (error) {
    console.error('[Webhook] handleIncomingMessage error:', error);
  }
}

/**
 * Update chat when new message arrives
 * NEW FUNCTION
 */
async function updateChatOnMessage(env, phone, lastMessage, messageType, direction) {
  try {
    const now = new Date().toISOString();
    const isIncoming = direction === 'incoming';

    await env.DB.prepare(`
      UPDATE chats SET
        last_message = ?,
        last_message_type = ?,
        last_timestamp = ?,
        last_direction = ?,
        unread_count = unread_count + ?,
        total_messages = total_messages + 1,
        updated_at = ?
      WHERE phone = ?
    `).bind(
      lastMessage?.slice(0, 500),
      messageType,
      now,
      direction,
      isIncoming ? 1 : 0,
      now,
      phone
    ).run();

  } catch (error) {
    console.error('[Webhook] updateChatOnMessage error:', error);
  }
}

/**
 * Handle status updates (delivered, read, failed)
 */
async function handleStatusUpdates(env, statuses) {
  for (const status of statuses) {
    try {
      const messageId = status.id;
      const statusValue = status.status;
      const timestamp = status.timestamp;

      console.log(`📊 Status: ${messageId} → ${statusValue}`);

      let updateQuery = 'UPDATE messages SET status = ?';
      const params = [statusValue];

      if (statusValue === 'delivered') {
        updateQuery += ', delivered_at = ?';
        params.push(new Date(parseInt(timestamp) * 1000).toISOString());
      } else if (statusValue === 'read') {
        updateQuery += ', read_at = ?';
        params.push(new Date(parseInt(timestamp) * 1000).toISOString());
      }

      updateQuery += ' WHERE message_id = ?';
      params.push(messageId);

      await env.DB.prepare(updateQuery).bind(...params).run();

    } catch (e) {
      console.warn('[Webhook] Status update failed:', e.message);
    }
  }
}

/**
 * Extract content from different message types
 */
function extractContent(message) {
  const type = message.type;

  switch (type) {
    case 'text':
      return { text: message.text?.body || '' };

    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      return {
        media_id: message[type]?.id,
        caption: message[type]?.caption,
        text: message[type]?.caption || `[${type}]`,
        mime_type: message[type]?.mime_type,
      };

    case 'location':
      return {
        text: `📍 Location: ${message.location?.latitude}, ${message.location?.longitude}`,
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
      };

    case 'contacts':
      const contactName = message.contacts?.[0]?.name?.formatted_name || 'Unknown';
      return {
        text: `👤 Contact: ${contactName}`,
        contacts: message.contacts,
      };

    case 'button':
      return {
        text: message.button?.text,
        button_text: message.button?.text,
        button_payload: message.button?.payload,
      };

    case 'interactive':
      const interactive = message.interactive;
      if (interactive?.type === 'button_reply') {
        return {
          text: interactive.button_reply?.title,
          button_text: interactive.button_reply?.title,
          button_payload: interactive.button_reply?.id,
        };
      } else if (interactive?.type === 'list_reply') {
        return {
          text: interactive.list_reply?.title,
          button_text: interactive.list_reply?.title,
          button_payload: interactive.list_reply?.id,
        };
      }
      return { text: '[interactive]' };

    case 'order':
      return { 
        text: '[Order Received]', 
        order: message.order,
        items: message.order?.product_items,
      };

    case 'reaction':
      return {
        text: `[Reaction: ${message.reaction?.emoji}]`,
        emoji: message.reaction?.emoji,
        reacted_message_id: message.reaction?.message_id,
      };

    default:
      return { text: `[${type}]` };
  }
}

/**
 * Get or create customer record
 */
async function getOrCreateCustomer(env, phone, contact) {
  try {
    let customer = await env.DB.prepare(
      'SELECT * FROM customers WHERE phone = ?'
    ).bind(phone).first();

    if (!customer) {
      const name = contact?.profile?.name || null;
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO customers (
          phone, name, segment, tier, language,
          message_count, order_count, total_spent,
          opted_in, first_seen, last_seen, created_at, updated_at
        )
        VALUES (?, ?, 'new', 'bronze', 'en', 1, 0, 0, 1, ?, ?, ?, ?)
      `).bind(phone, name, now, now, now, now).run();

      customer = await env.DB.prepare(
        'SELECT * FROM customers WHERE phone = ?'
      ).bind(phone).first();

      console.log(`👤 New customer created: ${phone} (${name || 'Anonymous'})`);
    }

    return customer;

  } catch (error) {
    console.error('[Webhook] getOrCreateCustomer error:', error);
    return { phone, name: null };
  }
}
/**
 * Save message to database
 */
async function saveMessage(env, msg) {
  try {
    await env.DB.prepare(`
      INSERT INTO messages (
        message_id, phone, text, message_type, direction,
        media_id, media_caption, button_id, button_text,
        context_message_id, status, timestamp, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)
    `).bind(
      msg.message_id,
      msg.phone,
      msg.text,
      msg.message_type,
      msg.direction,
      msg.media_id || null,
      msg.media_caption || null,
      msg.button_id || null,
      msg.button_text || null,
      msg.context_message_id || null,
      msg.timestamp,
      new Date().toISOString()
    ).run();

    console.log(`💾 Message saved: ${msg.message_id}`);

  } catch (error) {
    console.error('[Webhook] saveMessage error:', error);
  }
}

/**
 * Get or create chat record
 * FIXED: Uses 'chats' table (not 'conversations')
 */
async function getOrCreateChat(env, phone, customerName) {
  try {
    let chat = await env.DB.prepare(
      'SELECT * FROM chats WHERE phone = ?'
    ).bind(phone).first();

    if (!chat) {
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO chats (
          phone, customer_name, status, priority,
          unread_count, total_messages, is_bot_enabled,
          created_at, updated_at
        )
        VALUES (?, ?, 'open', 'normal', 0, 0, 1, ?, ?)
      `).bind(phone, customerName, now, now).run();

      chat = await env.DB.prepare(
        'SELECT * FROM chats WHERE phone = ?'
      ).bind(phone).first();

      console.log(`💬 New chat created: ${phone}`);
    }

    return chat;

  } catch (error) {
    console.error('[Webhook] getOrCreateChat error:', error);
    return { phone };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT AS OBJECT (matches index.js import pattern)
// ═══════════════════════════════════════════════════════════════

export const WebhookHandler = {
  verify,
  handle,
};

export default WebhookHandler;
