// worker/src/handlers/webhook.js
/**
 * ═══════════════════════════════════════════════════════════════
 * WhatsApp Webhook Handler
 * ═══════════════════════════════════════════════════════════════
 */

import { AutoResponder } from '../services/autoresponder';
import { WhatsAppService } from '../services/whatsapp';

/**
 * Verify webhook (GET from Meta)
 */
export function verifyWebhook(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  console.log('[Webhook] Verification attempt:', { mode, token: token?.slice(0, 5) + '***' });

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verified');
    return new Response(challenge, { status: 200 });
  }

  console.log('[Webhook] ❌ Verification failed');
  return new Response('Forbidden', { status: 403 });
}

/**
 * Handle webhook events (POST from Meta)
 */
export async function handleWebhook(request, env) {
  try {
    const body = await request.json();
    
    // Log for debugging
    console.log('[Webhook] Received:', JSON.stringify(body).slice(0, 500));

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Handle status updates
        if (value.statuses) {
          await handleStatusUpdates(env, value.statuses);
        }

        // Handle incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            await handleIncomingMessage(env, message, value.contacts?.[0]);
          }
        }
      }
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response('Error', { status: 500 });
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

  console.log(`📩 Message from ${phone}: ${messageType}`);

  // Get or create customer
  let customer = await getOrCreateCustomer(env, phone, contact);

  // Get or create conversation
  let conversation = await getOrCreateConversation(env, phone, customer.id);

  // Check if first message
  const isFirstMessage = !customer.first_message_at;

  // Extract content
  const content = extractContent(message);

  // Save incoming message
  await saveMessage(env, {
    wa_message_id: messageId,
    conversation_id: conversation.id,
    phone,
    direction: 'inbound',
    type: messageType,
    content: content.text,
    caption: content.caption,
    media_id: content.media_id,
    button_text: content.button_text,
    button_payload: content.button_payload,
    context_message_id: message.context?.id,
    sent_at: new Date(parseInt(timestamp) * 1000).toISOString(),
  });

  // Update conversation
  await env.DB.prepare(`
    UPDATE conversations SET
      last_message = ?,
      last_message_at = ?,
      last_message_type = ?,
      unread_count = unread_count + 1,
      window_expires_at = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    content.text || `[${messageType}]`,
    new Date().toISOString(),
    messageType,
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    new Date().toISOString(),
    conversation.id
  ).run();

  // Update customer first message time
  if (isFirstMessage) {
    await env.DB.prepare(
      'UPDATE customers SET first_message_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), customer.id).run();
  }

  // Process with auto responder
  const autoResponder = new AutoResponder(env);
  await autoResponder.process({
    phone,
    message,
    content,
    customer,
    conversation,
    isFirstMessage,
  });

  // Mark as read
  try {
    const wa = new WhatsAppService(env);
    await wa.markAsRead(messageId);
  } catch (e) {
    console.warn('Mark read failed:', e);
  }
}

/**
 * Handle status updates
 */
async function handleStatusUpdates(env, statuses) {
  for (const status of statuses) {
    const messageId = status.id;
    const statusValue = status.status;
    const timestamp = status.timestamp;

    const updates = { status: statusValue };

    if (statusValue === 'delivered') {
      updates.delivered_at = new Date(parseInt(timestamp) * 1000).toISOString();
    } else if (statusValue === 'read') {
      updates.read_at = new Date(parseInt(timestamp) * 1000).toISOString();
    } else if (statusValue === 'failed') {
      updates.error_code = status.errors?.[0]?.code;
      updates.error_message = status.errors?.[0]?.message;
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), messageId];

    await env.DB.prepare(
      `UPDATE messages SET ${setClauses} WHERE wa_message_id = ?`
    ).bind(...values).run();

    console.log(`📊 Status: ${messageId} → ${statusValue}`);
  }
}

/**
 * Extract content from message
 */
function extractContent(message) {
  const type = message.type;

  switch (type) {
    case 'text':
      return { text: message.text?.body };

    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      return {
        media_id: message[type]?.id,
        caption: message[type]?.caption,
        text: message[type]?.caption || `[${type}]`,
      };

    case 'location':
      return {
        text: `📍 Location: ${message.location?.latitude}, ${message.location?.longitude}`,
      };

    case 'contacts':
      return {
        text: `👤 Contact: ${message.contacts?.[0]?.name?.formatted_name}`,
      };

    case 'button':
      return {
        text: message.button?.text,
        button_text: message.button?.text,
        button_payload: message.button?.payload,
      };

    case 'interactive':
      const interactive = message.interactive;
      if (interactive.type === 'button_reply') {
        return {
          text: interactive.button_reply?.title,
          button_text: interactive.button_reply?.title,
          button_payload: interactive.button_reply?.id,
        };
      } else if (interactive.type === 'list_reply') {
        return {
          text: interactive.list_reply?.title,
          button_payload: interactive.list_reply?.id,
        };
      }
      return { text: '[interactive]' };

    case 'order':
      return { text: '[Order Received]', order: message.order };

    default:
      return { text: `[${type}]` };
  }
}

/**
 * Get or create customer
 */
async function getOrCreateCustomer(env, phone, contact) {
  let customer = await env.DB.prepare(
    'SELECT * FROM customers WHERE phone = ?'
  ).bind(phone).first();

  if (!customer) {
    await env.DB.prepare(`
      INSERT INTO customers (phone, wa_id, name, last_message_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      phone,
      contact?.wa_id || phone,
      contact?.profile?.name || null,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    customer = await env.DB.prepare(
      'SELECT * FROM customers WHERE phone = ?'
    ).bind(phone).first();
  } else {
    await env.DB.prepare(`
      UPDATE customers SET last_message_at = ?, updated_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), new Date().toISOString(), customer.id).run();
  }

  return customer;
}

/**
 * Get or create conversation
 */
async function getOrCreateConversation(env, phone, customerId) {
  let conv = await env.DB.prepare(
    'SELECT * FROM conversations WHERE phone = ?'
  ).bind(phone).first();

  if (!conv) {
    await env.DB.prepare(`
      INSERT INTO conversations (phone, customer_id, last_message_at, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(phone, customerId, new Date().toISOString(), new Date().toISOString()).run();

    conv = await env.DB.prepare(
      'SELECT * FROM conversations WHERE phone = ?'
    ).bind(phone).first();
  }

  return conv;
}

/**
 * Save message to DB
 */
async function saveMessage(env, msg) {
  const columns = Object.keys(msg).filter(k => msg[k] !== undefined);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map(k => msg[k]);

  await env.DB.prepare(
    `INSERT INTO messages (${columns.join(', ')}, created_at) VALUES (${placeholders}, ?)`
  ).bind(...values, new Date().toISOString()).run();
}
