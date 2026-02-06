/**
 * ════════════════════════════════════════════════════════════════
 * AUTOMATION HANDLER
 * Workflow automation management
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { sendText, sendButtons, sendTemplate } from '../services/whatsapp.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleAutomation(request, ctx, path) {
  const { method, env } = ctx;
  
  try {
    // GET /api/automations - List automations
    if (path === '/api/automations' && method === 'GET') {
      return getAutomations(ctx);
    }
    
    // POST /api/automations - Create automation
    if (path === '/api/automations' && method === 'POST') {
      return createAutomation(request, ctx);
    }
    
    // GET /api/automations/:id
    const idMatch = path.match(/^\/api\/automations\/(\d+)$/);
    if (idMatch && method === 'GET') {
      return getAutomation(parseInt(idMatch[1]), ctx);
    }
    
    // PUT /api/automations/:id
    if (idMatch && method === 'PUT') {
      return updateAutomation(parseInt(idMatch[1]), await request.json(), ctx);
    }
    
    // DELETE /api/automations/:id
    if (idMatch && method === 'DELETE') {
      return deleteAutomation(parseInt(idMatch[1]), ctx);
    }
    
    // POST /api/automations/:id/toggle
    const toggleMatch = path.match(/^\/api\/automations\/(\d+)\/toggle$/);
    if (toggleMatch && method === 'POST') {
      return toggleAutomation(parseInt(toggleMatch[1]), ctx);
    }
    
    // GET /api/automations/:id/logs
    const logsMatch = path.match(/^\/api\/automations\/(\d+)\/logs$/);
    if (logsMatch && method === 'GET') {
      return getAutomationLogs(parseInt(logsMatch[1]), ctx);
    }
    
    // POST /api/automations/trigger - Manual trigger
    if (path === '/api/automations/trigger' && method === 'POST') {
      return triggerAutomation(request, ctx);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Automation] Error:', error.message);
    return errorResponse('Automation processing error', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// GET AUTOMATIONS
// ═════════════════════════════════════════════════════════════════

async function getAutomations(ctx) {
  const { env } = ctx;
  
  const { results } = await env.DB.prepare(`
    SELECT * FROM automations ORDER BY created_at DESC
  `).all();
  
  return jsonResponse({
    automations: results.map(formatAutomation),
  });
}

// ═════════════════════════════════════════════════════════════════
// CREATE AUTOMATION
// ═════════════════════════════════════════════════════════════════

async function createAutomation(request, ctx) {
  const { env } = ctx;
  const data = await request.json();
  
  const { name, description, triggerType, triggerConditions, actions, delayMinutes } = data;
  
  if (!name || !triggerType || !actions?.length) {
    return errorResponse('Name, trigger type, and actions required');
  }
  
  // Validate trigger type
  const validTriggers = [
    'new_customer', 'new_order', 'order_confirmed', 'order_shipped', 
    'order_delivered', 'payment_received', 'cart_abandoned', 
    'customer_inactive', 'keyword_match'
  ];
  
  if (!validTriggers.includes(triggerType)) {
    return errorResponse('Invalid trigger type');
  }
  
  // Validate actions
  for (const action of actions) {
    if (!['send_message', 'send_template', 'add_label', 'remove_label', 'assign_agent', 'update_segment'].includes(action.type)) {
      return errorResponse(`Invalid action type: ${action.type}`);
    }
  }
  
  const result = await env.DB.prepare(`
    INSERT INTO automations (name, description, trigger_type, trigger_conditions, actions, delay_minutes, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).bind(
    name,
    description,
    triggerType,
    JSON.stringify(triggerConditions || {}),
    JSON.stringify(actions),
    delayMinutes || 0
  ).run();
  
  return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);
}

// ═════════════════════════════════════════════════════════════════
// GET SINGLE AUTOMATION
// ═════════════════════════════════════════════════════════════════

async function getAutomation(id, ctx) {
  const { env } = ctx;
  
  const automation = await env.DB.prepare(`
    SELECT * FROM automations WHERE id = ?
  `).bind(id).first();
  
  if (!automation) {
    return errorResponse('Automation not found', 404);
  }
  
  // Get recent logs
  const { results: logs } = await env.DB.prepare(`
    SELECT * FROM automation_log WHERE automation_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(id).all();
  
  return jsonResponse({
    automation: formatAutomation(automation),
    logs,
  });
}

// ═════════════════════════════════════════════════════════════════
// UPDATE AUTOMATION
// ═════════════════════════════════════════════════════════════════

async function updateAutomation(id, data, ctx) {
  const { env } = ctx;
  
  const updates = [];
  const params = [];
  
  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  
  if (data.triggerConditions !== undefined) {
    updates.push('trigger_conditions = ?');
    params.push(JSON.stringify(data.triggerConditions));
  }
  
  if (data.actions !== undefined) {
    updates.push('actions = ?');
    params.push(JSON.stringify(data.actions));
  }
  
  if (data.delayMinutes !== undefined) {
    updates.push('delay_minutes = ?');
    params.push(data.delayMinutes);
  }
  
  if (data.isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(data.isActive ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return errorResponse('No updates provided');
  }
  
  params.push(id);
  
  await env.DB.prepare(`
    UPDATE automations SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// DELETE AUTOMATION
// ═════════════════════════════════════════════════════════════════

async function deleteAutomation(id, ctx) {
  const { env } = ctx;
  
  await env.DB.prepare(`DELETE FROM automation_log WHERE automation_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM automations WHERE id = ?`).bind(id).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// TOGGLE AUTOMATION
// ═════════════════════════════════════════════════════════════════

async function toggleAutomation(id, ctx) {
  const { env } = ctx;
  
  const automation = await env.DB.prepare(`
    SELECT is_active FROM automations WHERE id = ?
  `).bind(id).first();
  
  if (!automation) {
    return errorResponse('Automation not found', 404);
  }
  
  const newState = automation.is_active ? 0 : 1;
  
  await env.DB.prepare(`
    UPDATE automations SET is_active = ? WHERE id = ?
  `).bind(newState, id).run();
  
  return jsonResponse({ success: true, isActive: newState === 1 });
}

// ═════════════════════════════════════════════════════════════════
// GET AUTOMATION LOGS
// ═════════════════════════════════════════════════════════════════

async function getAutomationLogs(id, ctx) {
  const { env, url } = ctx;
  
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  const { results } = await env.DB.prepare(`
    SELECT * FROM automation_log WHERE automation_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(id, limit, offset).all();
  
  return jsonResponse({ logs: results });
}

// ═════════════════════════════════════════════════════════════════
// TRIGGER AUTOMATION (Called by webhook/cron)
// ═════════════════════════════════════════════════════════════════

export async function executeAutomations(triggerType, triggerData, env) {
  // Get matching active automations
  const { results: automations } = await env.DB.prepare(`
    SELECT * FROM automations WHERE trigger_type = ? AND is_active = 1
  `).bind(triggerType).all();
  
  for (const automation of automations) {
    try {
      // Check trigger conditions
      const conditions = safeJsonParse(automation.trigger_conditions, {});
      
      if (!matchesConditions(conditions, triggerData)) {
        continue;
      }
      
      // Check delay
      if (automation.delay_minutes > 0) {
        // Schedule for later (handled by cron)
        await env.DB.prepare(`
          INSERT INTO automation_log (automation_id, phone, trigger_type, trigger_data, status, created_at)
          VALUES (?, ?, ?, ?, 'scheduled', datetime('now'))
        `).bind(automation.id, triggerData.phone, triggerType, JSON.stringify(triggerData)).run();
        continue;
      }
      
      // Execute actions immediately
      await executeActions(automation, triggerData, env);
      
    } catch (error) {
      console.error(`[Automation ${automation.id}] Error:`, error.message);
      
      await env.DB.prepare(`
        INSERT INTO automation_log (automation_id, phone, trigger_type, trigger_data, status, error_message, created_at)
        VALUES (?, ?, ?, ?, 'failed', ?, datetime('now'))
      `).bind(automation.id, triggerData.phone, triggerType, JSON.stringify(triggerData), error.message).run();
    }
  }
}

async function executeActions(automation, triggerData, env) {
  const actions = safeJsonParse(automation.actions, []);
  const phone = triggerData.phone;
  const executedActions = [];
  
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'send_message':
          const message = replaceVariables(action.message, triggerData);
          if (action.buttons?.length) {
            await sendButtons(phone, message, action.buttons, env);
          } else {
            await sendText(phone, message, env);
          }
          executedActions.push({ type: 'send_message', success: true });
          break;
          
        case 'send_template':
          const params = (action.params || []).map(p => replaceVariables(p, triggerData));
          await sendTemplate(phone, action.templateName, params, 'en', env);
          executedActions.push({ type: 'send_template', success: true });
          break;
          
        case 'add_label':
          await addLabelToCustomer(phone, action.label, env);
          executedActions.push({ type: 'add_label', label: action.label, success: true });
          break;
          
        case 'remove_label':
          await removeLabelFromCustomer(phone, action.label, env);
          executedActions.push({ type: 'remove_label', label: action.label, success: true });
          break;
          
        case 'assign_agent':
          await env.DB.prepare(`
            UPDATE chats SET assigned_to = ?, status = 'active' WHERE phone = ?
          `).bind(action.agentId, phone).run();
          executedActions.push({ type: 'assign_agent', success: true });
          break;
          
        case 'update_segment':
          await env.DB.prepare(`
            UPDATE customers SET segment = ? WHERE phone = ?
          `).bind(action.segment, phone).run();
          executedActions.push({ type: 'update_segment', success: true });
          break;
      }
      
      // Delay between actions if specified
      if (action.delay) {
        await sleep(action.delay * 1000);
      }
    } catch (error) {
      executedActions.push({ type: action.type, success: false, error: error.message });
    }
  }
  
  // Log execution
  await env.DB.prepare(`
    INSERT INTO automation_log (automation_id, phone, trigger_type, trigger_data, actions_executed, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'success', datetime('now'))
  `).bind(
    automation.id,
    phone,
    automation.trigger_type,
    JSON.stringify(triggerData),
    JSON.stringify(executedActions)
  ).run();
  
  // Update automation stats
  await env.DB.prepare(`
    UPDATE automations SET triggered_count = triggered_count + 1, last_triggered_at = datetime('now') WHERE id = ?
  `).bind(automation.id).run();
}

// Manual trigger
async function triggerAutomation(request, ctx) {
  const { env } = ctx;
  const { automationId, phone, data } = await request.json();
  
  if (!automationId || !phone) {
    return errorResponse('Automation ID and phone required');
  }
  
  const automation = await env.DB.prepare(`
    SELECT * FROM automations WHERE id = ?
  `).bind(automationId).first();
  
  if (!automation) {
    return errorResponse('Automation not found', 404);
  }
  
  await executeActions(automation, { phone, ...data }, env);
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function matchesConditions(conditions, data) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }
  
  // Keyword match
  if (conditions.keywords?.length && data.message) {
    const lower = data.message.toLowerCase();
    const matched = conditions.keywords.some(k => lower.includes(k.toLowerCase()));
    if (!matched) return false;
  }
  
  // Segment match
  if (conditions.segments?.length && data.segment) {
    if (!conditions.segments.includes(data.segment)) return false;
  }
  
  // Order value
  if (conditions.minOrderValue && data.orderValue < conditions.minOrderValue) {
    return false;
  }
  
  return true;
}

function replaceVariables(text, data) {
  if (!text) return text;
  
  return text
    .replace(/\{\{name\}\}/gi, data.name || 'there')
    .replace(/\{\{phone\}\}/gi, data.phone || '')
    .replace(/\{\{order_id\}\}/gi, data.orderId || '')
    .replace(/\{\{order_total\}\}/gi, data.orderTotal || '')
    .replace(/\{\{tracking_id\}\}/gi, data.trackingId || '')
    .replace(/\{\{product_name\}\}/gi, data.productName || '');
}

async function addLabelToCustomer(phone, label, env) {
  const customer = await env.DB.prepare(`
    SELECT labels FROM customers WHERE phone = ?
  `).bind(phone).first();
  
  let labels = safeJsonParse(customer?.labels, []);
  if (!labels.includes(label)) {
    labels.push(label);
    await env.DB.prepare(`
      UPDATE customers SET labels = ? WHERE phone = ?
    `).bind(JSON.stringify(labels), phone).run();
    
    await env.DB.prepare(`
      UPDATE chats SET labels = ? WHERE phone = ?
    `).bind(JSON.stringify(labels), phone).run();
  }
}

async function removeLabelFromCustomer(phone, label, env) {
  const customer = await env.DB.prepare(`
    SELECT labels FROM customers WHERE phone = ?
  `).bind(phone).first();
  
  let labels = safeJsonParse(customer?.labels, []);
  labels = labels.filter(l => l !== label);
  
  await env.DB.prepare(`
    UPDATE customers SET labels = ? WHERE phone = ?
  `).bind(JSON.stringify(labels), phone).run();
  
  await env.DB.prepare(`
    UPDATE chats SET labels = ? WHERE phone = ?
  `).bind(JSON.stringify(labels), phone).run();
}

function formatAutomation(a) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    triggerType: a.trigger_type,
    triggerConditions: safeJsonParse(a.trigger_conditions, {}),
    actions: safeJsonParse(a.actions, []),
    delayMinutes: a.delay_minutes,
    triggeredCount: a.triggered_count,
    lastTriggeredAt: a.last_triggered_at,
    isActive: a.is_active === 1,
    createdAt: a.created_at,
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