/**
 * ════════════════════════════════════════════════════════════════
 * CHAT HANDLER
 * Chat list, messages, assignment, labels
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { sendPushNotification } from '../services/push.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleChat(request, ctx, path) {
  const { method, env, user } = ctx;
  
  try {
    // ─────────────────────────────────────────────────────────────
    // GET /api/chats - List all chats
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/chats' && method === 'GET') {
      return getChats(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/chats/:phone - Get single chat
    // ─────────────────────────────────────────────────────────────
    const phoneMatch = path.match(/^\/api\/chats\/(\d+)$/);
    if (phoneMatch && method === 'GET') {
      return getChat(phoneMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // PUT /api/chats/:phone - Update chat
    // ─────────────────────────────────────────────────────────────
    if (phoneMatch && method === 'PUT') {
      const data = await request.json();
      return updateChat(phoneMatch[1], data, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/chats/:phone/messages - Get messages
    // ─────────────────────────────────────────────────────────────
    const messagesMatch = path.match(/^\/api\/chats\/(\d+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      return getMessages(messagesMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/chats/:phone/read - Mark as read
    // ─────────────────────────────────────────────────────────────
    const readMatch = path.match(/^\/api\/chats\/(\d+)\/read$/);
    if (readMatch && method === 'POST') {
      return markAsRead(readMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/chats/:phone/assign - Assign agent
    // ─────────────────────────────────────────────────────────────
    const assignMatch = path.match(/^\/api\/chats\/(\d+)\/assign$/);
    if (assignMatch && method === 'POST') {
      const { agentId } = await request.json();
      return assignChat(assignMatch[1], agentId, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/chats/:phone/labels - Update labels
    // ─────────────────────────────────────────────────────────────
    const labelsMatch = path.match(/^\/api\/chats\/(\d+)\/labels$/);
    if (labelsMatch && method === 'POST') {
      const { labels } = await request.json();
      return updateLabels(labelsMatch[1], labels, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/chats/:phone/toggle-bot - Toggle bot
    // ─────────────────────────────────────────────────────────────
    const botMatch = path.match(/^\/api\/chats\/(\d+)\/toggle-bot$/);
    if (botMatch && method === 'POST') {
      return toggleBot(botMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // Customer routes
    // ─────────────────────────────────────────────────────────────
    if (path.startsWith('/api/customer')) {
      return handleCustomer(request, ctx, path);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Chat] Error:', error.message);
    return errorResponse('Failed to process chat request', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// GET CHATS LIST
// ═════════════════════════════════════════════════════════════════

async function getChats(ctx) {
  const { env, url } = ctx;
  
  // Parse query parameters
  const status = url.searchParams.get('status');
  const assigned = url.searchParams.get('assigned');
  const label = url.searchParams.get('label');
  const search = url.searchParams.get('search');
  const starred = url.searchParams.get('starred');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  // Build query
  let query = `
    SELECT 
      c.*,
      cu.email as customer_email,
      cu.segment,
      cu.tier,
      cu.order_count,
      cu.total_spent
    FROM chats c
    LEFT JOIN customers cu ON c.phone = cu.phone
    WHERE c.is_blocked = 0
  `;
  const params = [];
  
  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }
  
  if (assigned) {
    query += ` AND c.assigned_to = ?`;
    params.push(assigned);
  }
  
  if (label) {
    query += ` AND c.labels LIKE ?`;
    params.push(`%"${label}"%`);
  }
  
  if (starred === 'true') {
    query += ` AND c.is_starred = 1`;
  }
  
  if (search) {
    query += ` AND (c.phone LIKE ? OR c.customer_name LIKE ? OR c.last_message LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  
  // Count total
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const { total } = await env.DB.prepare(countQuery).bind(...params).first() || { total: 0 };
  
  // Get chats
  query += ` ORDER BY c.is_starred DESC, c.last_timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  // Get unread count
  const { unread } = await env.DB.prepare(`
    SELECT SUM(unread_count) as unread FROM chats WHERE unread_count > 0
  `).first() || { unread: 0 };
  
  return jsonResponse({
    chats: results.map(formatChat),
    total,
    unread: unread || 0,
    limit,
    offset,
  });
}

// ═════════════════════════════════════════════════════════════════
// GET SINGLE CHAT
// ═════════════════════════════════════════════════════════════════

async function getChat(phone, ctx) {
  const { env } = ctx;
  
  const chat = await env.DB.prepare(`
    SELECT 
      c.*,
      cu.name, cu.email, cu.address, cu.city, cu.state, cu.pincode,
      cu.segment, cu.tier, cu.labels as customer_labels,
      cu.order_count, cu.total_spent, cu.first_seen, cu.last_order_at,
      cu.cart
    FROM chats c
    LEFT JOIN customers cu ON c.phone = cu.phone
    WHERE c.phone = ?
  `).bind(phone).first();
  
  if (!chat) {
    return errorResponse('Chat not found', 404);
  }
  
  // Get recent orders
  const { results: orders } = await env.DB.prepare(`
    SELECT order_id, status, total, created_at
    FROM orders
    WHERE phone = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).bind(phone).all();
  
  return jsonResponse({
    ...formatChat(chat),
    customer: {
      name: chat.name,
      email: chat.email,
      address: chat.address,
      city: chat.city,
      state: chat.state,
      pincode: chat.pincode,
      segment: chat.segment,
      tier: chat.tier,
      labels: safeJsonParse(chat.customer_labels, []),
      orderCount: chat.order_count,
      totalSpent: chat.total_spent,
      firstSeen: chat.first_seen,
      lastOrderAt: chat.last_order_at,
      cart: safeJsonParse(chat.cart, []),
    },
    orders,
  });
}

// ═════════════════════════════════════════════════════════════════
// GET MESSAGES
// ═════════════════════════════════════════════════════════════════

async function getMessages(phone, ctx) {
  const { env, url } = ctx;
  
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const before = url.searchParams.get('before');
  
  let query = `
    SELECT * FROM messages
    WHERE phone = ?
  `;
  const params = [phone];
  
  if (before) {
    query += ` AND id < ?`;
    params.push(before);
  }
  
  query += ` ORDER BY timestamp DESC, id DESC LIMIT ?`;
  params.push(limit);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({
    messages: results.reverse().map(formatMessage),
    hasMore: results.length === limit,
  });
}

// ═════════════════════════════════════════════════════════════════
// UPDATE CHAT
// ═════════════════════════════════════════════════════════════════

async function updateChat(phone, data, ctx) {
  const { env } = ctx;
  
  const updates = [];
  const params = [];
  
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }
  
  if (data.priority !== undefined) {
    updates.push('priority = ?');
    params.push(data.priority);
  }
  
  if (data.is_starred !== undefined) {
    updates.push('is_starred = ?');
    params.push(data.is_starred ? 1 : 0);
  }
  
  if (data.is_blocked !== undefined) {
    updates.push('is_blocked = ?');
    params.push(data.is_blocked ? 1 : 0);
  }
  
  if (data.is_bot_enabled !== undefined) {
    updates.push('is_bot_enabled = ?');
    params.push(data.is_bot_enabled ? 1 : 0);
  }
  
  if (data.assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    params.push(data.assigned_to);
  }
  
  if (data.labels !== undefined) {
    updates.push('labels = ?');
    params.push(JSON.stringify(data.labels));
  }
  
  if (updates.length === 0) {
    return errorResponse('No updates provided');
  }
  
  updates.push('updated_at = datetime("now")');
  params.push(phone);
  
  await env.DB.prepare(`
    UPDATE chats SET ${updates.join(', ')} WHERE phone = ?
  `).bind(...params).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// MARK AS READ
// ═════════════════════════════════════════════════════════════════

async function markAsRead(phone, ctx) {
  const { env } = ctx;
  
  await env.DB.prepare(`
    UPDATE chats SET unread_count = 0, updated_at = datetime('now') WHERE phone = ?
  `).bind(phone).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// ASSIGN CHAT
// ═════════════════════════════════════════════════════════════════

async function assignChat(phone, agentId, ctx) {
  const { env, user } = ctx;
  
  await env.DB.prepare(`
    UPDATE chats 
    SET assigned_to = ?, status = 'active', updated_at = datetime('now')
    WHERE phone = ?
  `).bind(agentId, phone).run();
  
  // Notify assigned agent
  if (agentId && agentId !== user.userId) {
    await sendPushNotification(agentId, {
      title: 'Chat Assigned',
      body: `A chat has been assigned to you`,
      data: { type: 'chat_assigned', phone },
    }, env);
  }
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// UPDATE LABELS
// ═════════════════════════════════════════════════════════════════

async function updateLabels(phone, labels, ctx) {
  const { env } = ctx;
  
  await env.DB.prepare(`
    UPDATE chats SET labels = ?, updated_at = datetime('now') WHERE phone = ?
  `).bind(JSON.stringify(labels), phone).run();
  
  // Also update customer labels
  await env.DB.prepare(`
    UPDATE customers SET labels = ?, updated_at = datetime('now') WHERE phone = ?
  `).bind(JSON.stringify(labels), phone).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// TOGGLE BOT
// ═════════════════════════════════════════════════════════════════

async function toggleBot(phone, ctx) {
  const { env } = ctx;
  
  const chat = await env.DB.prepare(`
    SELECT is_bot_enabled FROM chats WHERE phone = ?
  `).bind(phone).first();
  
  if (!chat) {
    return errorResponse('Chat not found', 404);
  }
  
  const newState = chat.is_bot_enabled ? 0 : 1;
  
  await env.DB.prepare(`
    UPDATE chats SET is_bot_enabled = ?, updated_at = datetime('now') WHERE phone = ?
  `).bind(newState, phone).run();
  
  return jsonResponse({ success: true, botEnabled: newState === 1 });
}

// ═════════════════════════════════════════════════════════════════
// CUSTOMER HANDLER
// ═════════════════════════════════════════════════════════════════

async function handleCustomer(request, ctx, path) {
  const { method, env, url } = ctx;
  
  // GET /api/customers - List customers
  if (path === '/api/customers' && method === 'GET') {
    const segment = url.searchParams.get('segment');
    const tier = url.searchParams.get('tier');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    let query = `SELECT * FROM customers WHERE opted_in = 1`;
    const params = [];
    
    if (segment) {
      query += ` AND segment = ?`;
      params.push(segment);
    }
    
    if (tier) {
      query += ` AND tier = ?`;
      params.push(tier);
    }
    
    if (search) {
      query += ` AND (phone LIKE ? OR name LIKE ? OR email LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    
    query += ` ORDER BY last_seen DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    return jsonResponse({ customers: results });
  }
  
  // GET /api/customers/:phone
  const phoneMatch = path.match(/^\/api\/customers\/(\d+)$/);
  if (phoneMatch && method === 'GET') {
    const customer = await env.DB.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).bind(phoneMatch[1]).first();
    
    if (!customer) {
      return errorResponse('Customer not found', 404);
    }
    
    // Get order history
    const { results: orders } = await env.DB.prepare(`
      SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC
    `).bind(phoneMatch[1]).all();
    
    return jsonResponse({
      customer: {
        ...customer,
        labels: safeJsonParse(customer.labels, []),
        cart: safeJsonParse(customer.cart, []),
      },
      orders,
    });
  }
  
  // PUT /api/customers/:phone
  if (phoneMatch && method === 'PUT') {
    const data = await request.json();
    
    const updates = [];
    const params = [];
    
    const fields = ['name', 'email', 'address', 'city', 'state', 'pincode', 'segment', 'tier'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    
    if (data.labels !== undefined) {
      updates.push('labels = ?');
      params.push(JSON.stringify(data.labels));
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = datetime("now")');
      params.push(phoneMatch[1]);
      
      await env.DB.prepare(`
        UPDATE customers SET ${updates.join(', ')} WHERE phone = ?
      `).bind(...params).run();
    }
    
    return jsonResponse({ success: true });
  }
  
  return errorResponse('Not found', 404);
}

// ═════════════════════════════════════════════════════════════════
// FORMATTERS
// ═════════════════════════════════════════════════════════════════

function formatChat(chat) {
  return {
    phone: chat.phone,
    name: chat.customer_name || chat.name,
    email: chat.customer_email,
    lastMessage: chat.last_message,
    lastMessageType: chat.last_message_type,
    lastTimestamp: chat.last_timestamp,
    lastDirection: chat.last_direction,
    unreadCount: chat.unread_count,
    totalMessages: chat.total_messages,
    status: chat.status,
    priority: chat.priority,
    assignedTo: chat.assigned_to,
    labels: safeJsonParse(chat.labels, []),
    isStarred: chat.is_starred === 1,
    isBlocked: chat.is_blocked === 1,
    isBotEnabled: chat.is_bot_enabled === 1,
    segment: chat.segment,
    tier: chat.tier,
    orderCount: chat.order_count,
    totalSpent: chat.total_spent,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  };
}

function formatMessage(msg) {
  return {
    id: msg.id,
    messageId: msg.message_id,
    phone: msg.phone,
    text: msg.text,
    type: msg.message_type,
    direction: msg.direction,
    status: msg.status,
    mediaId: msg.media_id,
    mediaUrl: msg.media_url,
    mediaMime: msg.media_mime,
    mediaCaption: msg.media_caption,
    buttonId: msg.button_id,
    buttonText: msg.button_text,
    isAutoReply: msg.is_auto_reply === 1,
    isTemplate: msg.is_template === 1,
    templateName: msg.template_name,
    timestamp: msg.timestamp,
    deliveredAt: msg.delivered_at,
    readAt: msg.read_at,
  };
}

function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}