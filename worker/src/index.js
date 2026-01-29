/**
 * ════════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP E-COMMERCE API
 * Production-Ready Cloudflare Worker
 * ════════════════════════════════════════════════════════════════
 */

import { handleWebhook, handleWebhookVerify } from './handlers/webhook.js';
import { handleAuth } from './handlers/auth.js';
import { handleChat } from './handlers/chat.js';
import { handleMessage } from './handlers/message.js';
import { handleOrder } from './handlers/order.js';
import { handleProduct } from './handlers/product.js';
import { handlePayment } from './handlers/payment.js';
import { handleShipping } from './handlers/shipping.js';
import { handleBroadcast } from './handlers/broadcast.js';
import { handleAutomation } from './handlers/automation.js';
import { handleAnalytics } from './handlers/analytics.js';
import { handleCron } from './cron/index.js';

// ════════════════════════════════════════════════════════════════
// CORS & RESPONSE HELPERS
// ════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

// ════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ════════════════════════════════════════════════════════════════

async function authenticate(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  
  const token = auth.slice(7);
  
  // Check API key
  if (env.API_KEY && token === env.API_KEY) {
    return { type: 'api_key', role: 'admin' };
  }
  
  // Check session
  const session = await env.DB.prepare(`
    SELECT s.*, u.role, u.name FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first();
  
  if (session) {
    return { type: 'session', userId: session.user_id, role: session.role, name: session.name };
  }
  
  return null;
}

// ════════════════════════════════════════════════════════════════
// RATE LIMITING
// ════════════════════════════════════════════════════════════════

async function checkRateLimit(ip, env, limit = 100, window = 60) {
  if (!env.KV) return true;
  
  const key = `rate:${ip}`;
  const current = parseInt(await env.KV.get(key) || '0');
  
  if (current >= limit) return false;
  
  await env.KV.put(key, String(current + 1), { expirationTtl: window });
  return true;
}

// ════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Rate Limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await checkRateLimit(ip, env))) {
      return error('Too many requests', 429);
    }

    try {
      // ──────────────────────────────────────────────────────────
      // WEBHOOK (No Auth)
      // ──────────────────────────────────────────────────────────
      if (path === '/webhook') {
        if (method === 'GET') return handleWebhookVerify(request, env);
        if (method === 'POST') {
          ctx.waitUntil(handleWebhook(request, env));
          return new Response('OK');
        }
      }

      // ──────────────────────────────────────────────────────────
      // PAYMENT WEBHOOK (No Auth)
      // ──────────────────────────────────────────────────────────
      if (path === '/webhook/razorpay' && method === 'POST') {
        return handlePayment(request, env, 'webhook');
      }

      // ──────────────────────────────────────────────────────────
      // HEALTH CHECK
      // ──────────────────────────────────────────────────────────
      if (path === '/' || path === '/health') {
        return json({ status: 'ok', service: 'KAAPAV API', version: '1.0.0' });
      }

      // ──────────────────────────────────────────────────────────
      // AUTH ROUTES (No Auth Required)
      // ──────────────────────────────────────────────────────────
      if (path.startsWith('/api/auth')) {
        return handleAuth(request, env, path, method);
      }

      // ──────────────────────────────────────────────────────────
      // PROTECTED ROUTES
      // ──────────────────────────────────────────────────────────
      const user = await authenticate(request, env);
      if (!user) {
        return error('Unauthorized', 401);
      }

      // Inject user into request context
      const reqContext = { user, url, method, env, ctx };

      // ──────────────────────────────────────────────────────────
      // API ROUTES
      // ──────────────────────────────────────────────────────────

      // Stats & Dashboard
      if (path === '/api/stats') {
        return handleAnalytics(request, reqContext, 'stats');
      }
      if (path === '/api/analytics') {
        return handleAnalytics(request, reqContext, 'analytics');
      }

      // Chats
      if (path.startsWith('/api/chats')) {
        return handleChat(request, reqContext, path);
      }

      // Messages
      if (path.startsWith('/api/messages')) {
        return handleMessage(request, reqContext, path);
      }

      // Customers
      if (path.startsWith('/api/customers')) {
        return handleChat(request, reqContext, path.replace('customers', 'customer'));
      }

      // Orders
      if (path.startsWith('/api/orders')) {
        return handleOrder(request, reqContext, path);
      }

      // Products
      if (path.startsWith('/api/products')) {
        return handleProduct(request, reqContext, path);
      }

      // Payments
      if (path.startsWith('/api/payments')) {
        return handlePayment(request, env, path);
      }

      // Shipping
      if (path.startsWith('/api/shipping')) {
        return handleShipping(request, reqContext, path);
      }

      // Broadcasts
      if (path.startsWith('/api/broadcasts')) {
        return handleBroadcast(request, reqContext, path);
      }

      // Quick Replies
      if (path.startsWith('/api/quick-replies')) {
        return handleQuickReplies(request, reqContext, path);
      }

      // Templates
      if (path.startsWith('/api/templates')) {
        return handleTemplates(request, reqContext, path);
      }

      // Labels
      if (path.startsWith('/api/labels')) {
        return handleLabels(request, reqContext, path);
      }

      // Automations
      if (path.startsWith('/api/automations')) {
        return handleAutomation(request, reqContext, path);
      }

      // Settings
      if (path.startsWith('/api/settings')) {
        return handleSettings(request, reqContext, path);
      }

      // Push Subscriptions
      if (path.startsWith('/api/push')) {
        return handlePush(request, reqContext, path);
      }

      // ──────────────────────────────────────────────────────────
      // 404
      // ──────────────────────────────────────────────────────────
      return error('Not Found', 404);

    } catch (err) {
      console.error('[API Error]', err.message, err.stack);
      return error(env.ENVIRONMENT === 'development' ? err.message : 'Internal Server Error', 500);
    }
  },

  // ════════════════════════════════════════════════════════════════
  // CRON HANDLER
  // ════════════════════════════════════════════════════════════════
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(event, env));
  }
};

// ════════════════════════════════════════════════════════════════
// ADDITIONAL HANDLERS
// ════════════════════════════════════════════════════════════════

async function handleQuickReplies(request, ctx, path) {
  const { method, env } = ctx;

  if (method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT * FROM quick_replies WHERE is_active = 1 ORDER BY use_count DESC
    `).all();
    return json(results);
  }

  if (method === 'POST') {
    const data = await request.json();
    const { shortcut, title, message, category, buttons, message_type } = data;
    
    await env.DB.prepare(`
      INSERT INTO quick_replies (shortcut, title, message, category, buttons, message_type)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(shortcut) DO UPDATE SET
        title = ?, message = ?, category = ?, buttons = ?, message_type = ?
    `).bind(
      shortcut, title, message, category || 'general', JSON.stringify(buttons), message_type || 'text',
      title, message, category || 'general', JSON.stringify(buttons), message_type || 'text'
    ).run();
    
    return json({ success: true });
  }

  if (method === 'DELETE') {
    const id = path.split('/').pop();
    await env.DB.prepare(`UPDATE quick_replies SET is_active = 0 WHERE id = ?`).bind(id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleTemplates(request, ctx, path) {
  const { method, env } = ctx;

  if (method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT * FROM templates ORDER BY sent_count DESC`).all();
    return json(results);
  }

  if (method === 'POST') {
    const data = await request.json();
    await env.DB.prepare(`
      INSERT INTO templates (name, category, language, header_type, header_text, body_text, footer_text, buttons, variables)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.name, data.category, data.language || 'en',
      data.header_type, data.header_text, data.body_text, data.footer_text,
      JSON.stringify(data.buttons), JSON.stringify(data.variables)
    ).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleLabels(request, ctx, path) {
  const { method, env } = ctx;

  if (method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT * FROM labels WHERE is_active = 1 ORDER BY name`).all();
    return json(results);
  }

  if (method === 'POST') {
    const { name, color, description } = await request.json();
    await env.DB.prepare(`INSERT INTO labels (name, color, description) VALUES (?, ?, ?)`).bind(name, color || '#DBAC35', description).run();
    return json({ success: true });
  }

  if (method === 'DELETE') {
    const id = path.split('/').pop();
    await env.DB.prepare(`UPDATE labels SET is_active = 0 WHERE id = ?`).bind(id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleSettings(request, ctx, path) {
  const { method, env } = ctx;

  if (method === 'GET') {
    const settings = await env.KV?.get('settings', 'json') || {};
    return json(settings);
  }

  if (method === 'PUT') {
    const data = await request.json();
    const current = await env.KV?.get('settings', 'json') || {};
    await env.KV?.put('settings', JSON.stringify({ ...current, ...data }));
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handlePush(request, ctx, path) {
  const { method, env, user } = ctx;

  if (method === 'POST' && path === '/api/push/subscribe') {
    const subscription = await request.json();
    await env.DB.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = ?, auth = ?
    `).bind(
      user.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
      subscription.keys.p256dh, subscription.keys.auth
    ).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
