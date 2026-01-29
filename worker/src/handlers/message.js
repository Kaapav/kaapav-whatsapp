/**
 * ════════════════════════════════════════════════════════════════
 * MESSAGE HANDLER
 * Send messages via WhatsApp API
 * ════════════════════════════════════════════════════════════════
 */

import { 
  sendText, 
  sendButtons, 
  sendList, 
  sendImage, 
  sendDocument,
  sendTemplate,
  sendLocation,
  markAsRead as waMarkAsRead
} from '../services/whatsapp.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { sendPushNotification } from '../services/push.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleMessage(request, ctx, path) {
  const { method, env } = ctx;
  
  try {
    // POST /api/messages/send - Send a message
    if (path === '/api/messages/send' && method === 'POST') {
      return sendMessage(request, ctx);
    }
    
    // POST /api/messages/send-template - Send template
    if (path === '/api/messages/send-template' && method === 'POST') {
      return sendTemplateMessage(request, ctx);
    }
    
    // POST /api/messages/bulk-send - Bulk send (non-broadcast)
    if (path === '/api/messages/bulk-send' && method === 'POST') {
      return bulkSend(request, ctx);
    }
    
    // POST /api/messages/mark-read - Mark as read
    if (path === '/api/messages/mark-read' && method === 'POST') {
      return markRead(request, ctx);
    }
    
    // GET /api/messages/quick-replies - Get quick replies
    if (path === '/api/messages/quick-replies' && method === 'GET') {
      return getQuickReplies(ctx);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Message] Error:', error.message);
    return errorResponse('Failed to process message', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═════════════════════════════════════════════════════════════════

async function sendMessage(request, ctx) {
  const { env, user } = ctx;
  const data = await request.json();
  
  const { phone, type, text, buttons, list, mediaUrl, mediaCaption, location } = data;
  
  if (!phone) {
    return errorResponse('Phone number required');
  }
  
  let result;
  let messageContent = text;
  
  try {
    switch (type) {
      case 'buttons':
        if (!buttons?.length) {
          return errorResponse('Buttons required for button message');
        }
        result = await sendButtons(phone, text, buttons, env);
        break;
        
      case 'list':
        if (!list?.sections?.length) {
          return errorResponse('List sections required');
        }
        result = await sendList(phone, text, list.buttonText || 'View Options', list.sections, env);
        break;
        
      case 'image':
        if (!mediaUrl) {
          return errorResponse('Media URL required for image');
        }
        result = await sendImage(phone, mediaUrl, mediaCaption, env);
        messageContent = mediaCaption || '[Image]';
        break;
        
      case 'document':
        if (!mediaUrl) {
          return errorResponse('Media URL required for document');
        }
        result = await sendDocument(phone, mediaUrl, data.filename, mediaCaption, env);
        messageContent = mediaCaption || '[Document]';
        break;
        
      case 'location':
        if (!location?.latitude || !location?.longitude) {
          return errorResponse('Latitude and longitude required');
        }
        result = await sendLocation(phone, location.latitude, location.longitude, location.name, location.address, env);
        messageContent = '[Location]';
        break;
        
      case 'text':
      default:
        if (!text) {
          return errorResponse('Text content required');
        }
        result = await sendText(phone, text, env);
        break;
    }
    
    if (!result.success) {
      return errorResponse(result.error || 'Failed to send message');
    }
    
    // Save outgoing message
    await env.DB.prepare(`
      INSERT INTO messages (message_id, phone, text, message_type, direction, media_url, timestamp, created_at)
      VALUES (?, ?, ?, ?, 'outgoing', ?, datetime('now'), datetime('now'))
    `).bind(result.messageId, phone, messageContent?.slice(0, 4000), type || 'text', mediaUrl).run();
    
    // Update chat
    await env.DB.prepare(`
      UPDATE chats SET
        last_message = ?,
        last_message_type = ?,
        last_timestamp = datetime('now'),
        last_direction = 'outgoing',
        total_messages = total_messages + 1,
        status = 'active',
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(messageContent?.slice(0, 500), type || 'text', phone).run();
    
    return jsonResponse({
      success: true,
      messageId: result.messageId,
    });
    
  } catch (error) {
    console.error('[Message] Send error:', error.message);
    return errorResponse(`Failed to send: ${error.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════
// SEND TEMPLATE MESSAGE
// ═════════════════════════════════════════════════════════════════

async function sendTemplateMessage(request, ctx) {
  const { env } = ctx;
  const { phone, templateName, params, language } = await request.json();
  
  if (!phone || !templateName) {
    return errorResponse('Phone and template name required');
  }
  
  try {
    const result = await sendTemplate(phone, templateName, params || [], language || 'en', env);
    
    if (!result.success) {
      return errorResponse(result.error || 'Failed to send template');
    }
    
    // Save message
    await env.DB.prepare(`
      INSERT INTO messages (message_id, phone, text, message_type, direction, is_template, template_name, timestamp, created_at)
      VALUES (?, ?, ?, 'template', 'outgoing', 1, ?, datetime('now'), datetime('now'))
    `).bind(result.messageId, phone, `[Template: ${templateName}]`, templateName).run();
    
    // Update template stats
    await env.DB.prepare(`
      UPDATE templates SET sent_count = sent_count + 1 WHERE name = ?
    `).bind(templateName).run();
    
    return jsonResponse({
      success: true,
      messageId: result.messageId,
    });
    
  } catch (error) {
    console.error('[Message] Template error:', error.message);
    return errorResponse(`Failed to send template: ${error.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════
// BULK SEND (For small lists, not broadcasts)
// ═════════════════════════════════════════════════════════════════

async function bulkSend(request, ctx) {
  const { env, ctx: workerCtx } = ctx;
  const { phones, type, text, buttons, templateName, params } = await request.json();
  
  if (!phones?.length) {
    return errorResponse('Phone numbers required');
  }
  
  if (phones.length > 50) {
    return errorResponse('Max 50 recipients. Use broadcasts for larger lists.');
  }
  
  // Process in background
  workerCtx.waitUntil(processBulkSend(phones, { type, text, buttons, templateName, params }, env));
  
  return jsonResponse({
    success: true,
    message: `Sending to ${phones.length} recipients`,
    count: phones.length,
  });
}

async function processBulkSend(phones, message, env) {
  const results = { sent: 0, failed: 0 };
  
  for (const phone of phones) {
    try {
      let result;
      
      if (message.templateName) {
        result = await sendTemplate(phone, message.templateName, message.params || [], 'en', env);
      } else if (message.buttons?.length) {
        result = await sendButtons(phone, message.text, message.buttons, env);
      } else {
        result = await sendText(phone, message.text, env);
      }
      
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
      }
      
      // Rate limiting
      await sleep(100);
    } catch {
      results.failed++;
    }
  }
  
  console.log(`[BulkSend] Completed: ${results.sent} sent, ${results.failed} failed`);
}

// ═════════════════════════════════════════════════════════════════
// MARK AS READ (WhatsApp)
// ═════════════════════════════════════════════════════════════════

async function markRead(request, ctx) {
  const { env } = ctx;
  const { messageId } = await request.json();
  
  if (!messageId) {
    return errorResponse('Message ID required');
  }
  
  try {
    await waMarkAsRead(messageId, env);
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse('Failed to mark as read');
  }
}

// ═════════════════════════════════════════════════════════════════
// GET QUICK REPLIES
// ═════════════════════════════════════════════════════════════════

async function getQuickReplies(ctx) {
  const { env, url } = ctx;
  
  const category = url.searchParams.get('category');
  
  let query = `SELECT * FROM quick_replies WHERE is_active = 1`;
  const params = [];
  
  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }
  
  query += ` ORDER BY use_count DESC`;
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({
    quickReplies: results.map(qr => ({
      ...qr,
      buttons: safeJsonParse(qr.buttons, null),
      variables: safeJsonParse(qr.variables, []),
    })),
  });
}

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}