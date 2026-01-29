/**
 * ════════════════════════════════════════════════════════════════
 * BROADCAST HANDLER
 * Campaign management and bulk messaging
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { generateBroadcastId } from '../config.js';
import { sendText, sendButtons, sendTemplate, sendImage } from '../services/whatsapp.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleBroadcast(request, ctx, path) {
  const { method, env, url } = ctx;
  
  try {
    // ─────────────────────────────────────────────────────────────
    // GET /api/broadcasts - List broadcasts
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/broadcasts' && method === 'GET') {
      return getBroadcasts(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/broadcasts - Create broadcast
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/broadcasts' && method === 'POST') {
      return createBroadcast(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/broadcasts/:id - Get broadcast details
    // ─────────────────────────────────────────────────────────────
    const idMatch = path.match(/^\/api\/broadcasts\/([A-Z0-9]+)$/);
    if (idMatch && method === 'GET') {
      return getBroadcast(idMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // PUT /api/broadcasts/:id - Update broadcast
    // ─────────────────────────────────────────────────────────────
    if (idMatch && method === 'PUT') {
      return updateBroadcast(idMatch[1], await request.json(), ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // DELETE /api/broadcasts/:id - Delete broadcast
    // ─────────────────────────────────────────────────────────────
    if (idMatch && method === 'DELETE') {
      return deleteBroadcast(idMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/broadcasts/:id/send - Start broadcast
    // ─────────────────────────────────────────────────────────────
    const sendMatch = path.match(/^\/api\/broadcasts\/([A-Z0-9]+)\/send$/);
    if (sendMatch && method === 'POST') {
      return startBroadcast(sendMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/broadcasts/:id/pause - Pause broadcast
    // ─────────────────────────────────────────────────────────────
    const pauseMatch = path.match(/^\/api\/broadcasts\/([A-Z0-9]+)\/pause$/);
    if (pauseMatch && method === 'POST') {
      return pauseBroadcast(pauseMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/broadcasts/:id/resume - Resume broadcast
    // ─────────────────────────────────────────────────────────────
    const resumeMatch = path.match(/^\/api\/broadcasts\/([A-Z0-9]+)\/resume$/);
    if (resumeMatch && method === 'POST') {
      return resumeBroadcast(resumeMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/broadcasts/:id/recipients - Get recipients
    // ─────────────────────────────────────────────────────────────
    const recipientsMatch = path.match(/^\/api\/broadcasts\/([A-Z0-9]+)\/recipients$/);
    if (recipientsMatch && method === 'GET') {
      return getRecipients(recipientsMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/broadcasts/preview - Preview target count
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/broadcasts/preview' && method === 'POST') {
      return previewTargets(request, ctx);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Broadcast] Error:', error.message);
    return errorResponse('Broadcast processing error', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// GET BROADCASTS
// ═════════════════════════════════════════════════════════════════

async function getBroadcasts(ctx) {
  const { env, url } = ctx;
  
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  let query = `SELECT * FROM broadcasts WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  // Get total count
  const { total } = await env.DB.prepare(`SELECT COUNT(*) as total FROM broadcasts`).first();
  
  return jsonResponse({
    broadcasts: results.map(formatBroadcast),
    total,
    limit,
    offset,
  });
}

// ═════════════════════════════════════════════════════════════════
// CREATE BROADCAST
// ═════════════════════════════════════════════════════════════════

async function createBroadcast(request, ctx) {
  const { env, user } = ctx;
  const data = await request.json();
  
  const {
    name,
    messageType,
    message,
    templateName,
    templateParams,
    mediaUrl,
    buttons,
    targetType,
    targetLabels,
    targetSegment,
    targetFilters,
    scheduledAt,
    sendRate,
  } = data;
  
  if (!name) {
    return errorResponse('Name required');
  }
  
  if (messageType === 'template' && !templateName) {
    return errorResponse('Template name required for template messages');
  }
  
  if (messageType !== 'template' && !message) {
    return errorResponse('Message content required');
  }
  
  const broadcastId = generateBroadcastId();
  
  // Get target count
  const targetCount = await getTargetCount(targetType, targetLabels, targetSegment, targetFilters, env);
  
  await env.DB.prepare(`
    INSERT INTO broadcasts (
      broadcast_id, name, message_type, message, template_name, template_params,
      media_url, buttons, target_type, target_labels, target_segment, target_filters,
      target_count, status, scheduled_at, send_rate, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    broadcastId,
    name,
    messageType || 'text',
    message,
    templateName,
    JSON.stringify(templateParams || []),
    mediaUrl,
    JSON.stringify(buttons || []),
    targetType || 'all',
    JSON.stringify(targetLabels || []),
    targetSegment,
    JSON.stringify(targetFilters || {}),
    targetCount,
    scheduledAt ? 'scheduled' : 'draft',
    scheduledAt,
    sendRate || 30,
    user.userId
  ).run();
  
  return jsonResponse({ success: true, broadcastId, targetCount }, 201);
}

// ═════════════════════════════════════════════════════════════════
// GET SINGLE BROADCAST
// ═════════════════════════════════════════════════════════════════

async function getBroadcast(broadcastId, ctx) {
  const { env } = ctx;
  
  const broadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();
  
  if (!broadcast) {
    return errorResponse('Broadcast not found', 404);
  }
  
  // Get recipient stats
  const stats = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM broadcast_recipients WHERE broadcast_id = ?
  `).bind(broadcastId).first();
  
  return jsonResponse({
    broadcast: formatBroadcast(broadcast),
    stats: {
      sent: stats?.sent || 0,
      delivered: stats?.delivered || 0,
      read: stats?.read || 0,
      failed: stats?.failed || 0,
      pending: stats?.pending || 0,
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// UPDATE BROADCAST
// ═════════════════════════════════════════════════════════════════

async function updateBroadcast(broadcastId, data, ctx) {
  const { env } = ctx;
  
  const broadcast = await env.DB.prepare(`
    SELECT status FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();
  
  if (!broadcast) {
    return errorResponse('Broadcast not found', 404);
  }
  
  if (!['draft', 'scheduled'].includes(broadcast.status)) {
    return errorResponse('Cannot update broadcast that is already sending');
  }
  
  const updates = [];
  const params = [];
  
  const fields = ['name', 'message', 'template_name', 'media_url', 'scheduled_at', 'send_rate'];
  
  for (const field of fields) {
    const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (data[camelCase] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[camelCase]);
    }
  }
  
  if (data.templateParams !== undefined) {
    updates.push('template_params = ?');
    params.push(JSON.stringify(data.templateParams));
  }
  
  if (data.buttons !== undefined) {
    updates.push('buttons = ?');
    params.push(JSON.stringify(data.buttons));
  }
  
  if (data.targetLabels !== undefined) {
    updates.push('target_labels = ?');
    params.push(JSON.stringify(data.targetLabels));
  }
  
  if (updates.length === 0) {
    return errorResponse('No updates provided');
  }
  
  params.push(broadcastId);
  
  await env.DB.prepare(`
    UPDATE broadcasts SET ${updates.join(', ')} WHERE broadcast_id = ?
  `).bind(...params).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// DELETE BROADCAST
// ═════════════════════════════════════════════════════════════════

async function deleteBroadcast(broadcastId, ctx) {
  const { env } = ctx;
  
  // Delete recipients first
  await env.DB.prepare(`DELETE FROM broadcast_recipients WHERE broadcast_id = ?`).bind(broadcastId).run();
  
  // Delete broadcast
  await env.DB.prepare(`DELETE FROM broadcasts WHERE broadcast_id = ?`).bind(broadcastId).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// START BROADCAST
// ═════════════════════════════════════════════════════════════════

async function startBroadcast(broadcastId, ctx) {
  const { env, ctx: workerCtx } = ctx;
  
  const broadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();
  
  if (!broadcast) {
    return errorResponse('Broadcast not found', 404);
  }
  
  if (!['draft', 'scheduled', 'paused'].includes(broadcast.status)) {
    return errorResponse(`Cannot start broadcast with status: ${broadcast.status}`);
  }
  
  // Get target recipients
  const recipients = await getTargetRecipients(
    broadcast.target_type,
    safeJsonParse(broadcast.target_labels, []),
    broadcast.target_segment,
    safeJsonParse(broadcast.target_filters, {}),
    env
  );
  
  if (recipients.length === 0) {
    return errorResponse('No recipients found for this broadcast');
  }
  
  // Insert recipients
  for (const phone of recipients) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO broadcast_recipients (broadcast_id, phone, status)
      VALUES (?, ?, 'pending')
    `).bind(broadcastId, phone).run();
  }
  
  // Update broadcast status
  await env.DB.prepare(`
    UPDATE broadcasts SET 
      status = 'sending',
      target_count = ?,
      started_at = datetime('now')
    WHERE broadcast_id = ?
  `).bind(recipients.length, broadcastId).run();
  
  // Start sending in background
  workerCtx.waitUntil(processBroadcast(broadcastId, env));
  
  return jsonResponse({ 
    success: true, 
    message: `Broadcasting to ${recipients.length} recipients`,
    recipientCount: recipients.length,
  });
}

// ═════════════════════════════════════════════════════════════════
// PROCESS BROADCAST (Background)
// ═════════════════════════════════════════════════════════════════

async function processBroadcast(broadcastId, env) {
  const broadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();
  
  if (!broadcast || broadcast.status !== 'sending') {
    return;
  }
  
  const sendRate = broadcast.send_rate || 30;
  const delayMs = Math.ceil(60000 / sendRate);
  
  // Get pending recipients
  const { results: recipients } = await env.DB.prepare(`
    SELECT phone FROM broadcast_recipients 
    WHERE broadcast_id = ? AND status = 'pending'
    LIMIT 100
  `).bind(broadcastId).all();
  
  let sent = 0;
  let failed = 0;
  
  for (const recipient of recipients) {
    // Check if paused
    const current = await env.DB.prepare(`
      SELECT status FROM broadcasts WHERE broadcast_id = ?
    `).bind(broadcastId).first();
    
    if (current?.status !== 'sending') {
      break;
    }
    
    try {
      let result;
      
      if (broadcast.message_type === 'template') {
        result = await sendTemplate(
          recipient.phone,
          broadcast.template_name,
          safeJsonParse(broadcast.template_params, []),
          'en',
          env
        );
      } else if (broadcast.message_type === 'image' && broadcast.media_url) {
        result = await sendImage(recipient.phone, broadcast.media_url, broadcast.message, env);
      } else if (broadcast.message_type === 'buttons' && broadcast.buttons) {
        result = await sendButtons(
          recipient.phone,
          broadcast.message,
          safeJsonParse(broadcast.buttons, []),
          env
        );
      } else {
        result = await sendText(recipient.phone, broadcast.message, env);
      }
      
      if (result.success) {
        await env.DB.prepare(`
          UPDATE broadcast_recipients SET 
            status = 'sent',
            message_id = ?,
            sent_at = datetime('now')
          WHERE broadcast_id = ? AND phone = ?
        `).bind(result.messageId, broadcastId, recipient.phone).run();
        sent++;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      await env.DB.prepare(`
        UPDATE broadcast_recipients SET 
          status = 'failed',
          error_message = ?,
          failed_at = datetime('now')
        WHERE broadcast_id = ? AND phone = ?
      `).bind(error.message?.slice(0, 500), broadcastId, recipient.phone).run();
      failed++;
    }
    
    // Rate limiting delay
    await sleep(delayMs);
  }
  
  // Update broadcast counts
  await env.DB.prepare(`
    UPDATE broadcasts SET 
      sent_count = sent_count + ?,
      failed_count = failed_count + ?
    WHERE broadcast_id = ?
  `).bind(sent, failed, broadcastId).run();
  
  // Check if complete
  const remaining = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM broadcast_recipients 
    WHERE broadcast_id = ? AND status = 'pending'
  `).bind(broadcastId).first();
  
  if (remaining?.count === 0) {
    await env.DB.prepare(`
      UPDATE broadcasts SET 
        status = 'completed',
        completed_at = datetime('now')
      WHERE broadcast_id = ?
    `).bind(broadcastId).run();
  } else if (recipients.length === 100) {
    // More to send - continue in next iteration
    // This would be handled by the cron job
  }
  
  console.log(`[Broadcast ${broadcastId}] Sent: ${sent}, Failed: ${failed}, Remaining: ${remaining?.count}`);
}

// ═════════════════════════════════════════════════════════════════
// PAUSE/RESUME BROADCAST
// ═════════════════════════════════════════════════════════════════

async function pauseBroadcast(broadcastId, ctx) {
  const { env } = ctx;
  
  await env.DB.prepare(`
    UPDATE broadcasts SET status = 'paused' WHERE broadcast_id = ? AND status = 'sending'
  `).bind(broadcastId).run();
  
  return jsonResponse({ success: true });
}

async function resumeBroadcast(broadcastId, ctx) {
  const { env, ctx: workerCtx } = ctx;
  
  await env.DB.prepare(`
    UPDATE broadcasts SET status = 'sending' WHERE broadcast_id = ? AND status = 'paused'
  `).bind(broadcastId).run();
  
  // Continue sending
  workerCtx.waitUntil(processBroadcast(broadcastId, env));
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// GET RECIPIENTS
// ═════════════════════════════════════════════════════════════════

async function getRecipients(broadcastId, ctx) {
  const { env, url } = ctx;
  
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  let query = `
    SELECT br.*, c.name as customer_name
    FROM broadcast_recipients br
    LEFT JOIN customers c ON br.phone = c.phone
    WHERE br.broadcast_id = ?
  `;
  const params = [broadcastId];
  
  if (status) {
    query += ` AND br.status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY br.id LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({ recipients: results });
}

// ═════════════════════════════════════════════════════════════════
// PREVIEW TARGETS
// ═════════════════════════════════════════════════════════════════

async function previewTargets(request, ctx) {
  const { env } = ctx;
  const { targetType, targetLabels, targetSegment, targetFilters } = await request.json();
  
  const count = await getTargetCount(targetType, targetLabels, targetSegment, targetFilters, env);
  
  return jsonResponse({ count });
}

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

async function getTargetCount(targetType, targetLabels, targetSegment, targetFilters, env) {
  const query = buildTargetQuery(targetType, targetLabels, targetSegment, targetFilters, true);
  const result = await env.DB.prepare(query.sql).bind(...query.params).first();
  return result?.count || 0;
}

async function getTargetRecipients(targetType, targetLabels, targetSegment, targetFilters, env) {
  const query = buildTargetQuery(targetType, targetLabels, targetSegment, targetFilters, false);
  const { results } = await env.DB.prepare(query.sql).bind(...query.params).all();
  return results.map(r => r.phone);
}

function buildTargetQuery(targetType, targetLabels, targetSegment, targetFilters, countOnly) {
  let sql = countOnly ? 
    `SELECT COUNT(*) as count FROM customers WHERE opted_in = 1` :
    `SELECT phone FROM customers WHERE opted_in = 1`;
  const params = [];
  
  if (targetType === 'labels' && targetLabels?.length) {
    const labelConditions = targetLabels.map(() => `labels LIKE ?`).join(' OR ');
    sql += ` AND (${labelConditions})`;
    params.push(...targetLabels.map(l => `%"${l}"%`));
  }
  
  if (targetType === 'segment' && targetSegment) {
    sql += ` AND segment = ?`;
    params.push(targetSegment);
  }
  
  if (targetFilters) {
    if (targetFilters.minOrders) {
      sql += ` AND order_count >= ?`;
      params.push(targetFilters.minOrders);
    }
    if (targetFilters.maxOrders) {
      sql += ` AND order_count <= ?`;
      params.push(targetFilters.maxOrders);
    }
    if (targetFilters.minSpent) {
      sql += ` AND total_spent >= ?`;
      params.push(targetFilters.minSpent);
    }
    if (targetFilters.lastSeenDays) {
      sql += ` AND last_seen >= datetime('now', '-' || ? || ' days')`;
      params.push(targetFilters.lastSeenDays);
    }
  }
  
  return { sql, params };
}

function formatBroadcast(b) {
  return {
    id: b.broadcast_id,
    name: b.name,
    messageType: b.message_type,
    message: b.message,
    templateName: b.template_name,
    templateParams: safeJsonParse(b.template_params, []),
    mediaUrl: b.media_url,
    buttons: safeJsonParse(b.buttons, []),
    targetType: b.target_type,
    targetLabels: safeJsonParse(b.target_labels, []),
    targetSegment: b.target_segment,
    targetFilters: safeJsonParse(b.target_filters, {}),
    targetCount: b.target_count,
    sentCount: b.sent_count,
    deliveredCount: b.delivered_count,
    readCount: b.read_count,
    failedCount: b.failed_count,
    clickedCount: b.clicked_count,
    status: b.status,
    scheduledAt: b.scheduled_at,
    startedAt: b.started_at,
    completedAt: b.completed_at,
    sendRate: b.send_rate,
    createdBy: b.created_by,
    createdAt: b.created_at,
  };
}

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