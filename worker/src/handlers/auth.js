/**
 * ════════════════════════════════════════════════════════════════
 * AUTHENTICATION HANDLER
 * Login, Register, Session Management
 * ════════════════════════════════════════════════════════════════
 */

import { hashPassword, verifyPassword, createSession, destroySession, destroyAllSessions } from '../middleware/auth.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { RateLimiter, RATE_LIMITS } from '../middleware/rateLimit.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleAuth(request, env, path, method) {
  try {
    // Rate limit login attempts
    if (path === '/api/auth/login' && method === 'POST') {
      const limiter = new RateLimiter(env.KV);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { allowed } = await limiter.check(`login:${ip}`, 5, 900);
      
      if (!allowed) {
        return errorResponse('Too many login attempts. Try again in 15 minutes.', 429);
      }
    }

    switch (path) {
      case '/api/auth/login':
        return method === 'POST' ? handleLogin(request, env) : errorResponse('Method not allowed', 405);
        
      case '/api/auth/register':
        return method === 'POST' ? handleRegister(request, env) : errorResponse('Method not allowed', 405);
        
      case '/api/auth/logout':
        return method === 'POST' ? handleLogout(request, env) : errorResponse('Method not allowed', 405);
        
      case '/api/auth/me':
        return method === 'GET' ? handleMe(request, env) : errorResponse('Method not allowed', 405);
        
      case '/api/auth/refresh':
        return method === 'POST' ? handleRefresh(request, env) : errorResponse('Method not allowed', 405);
        
      case '/api/auth/change-password':
        return method === 'POST' ? handleChangePassword(request, env) : errorResponse('Method not allowed', 405);
        
      case '/api/auth/forgot-password':
        return method === 'POST' ? handleForgotPassword(request, env) : errorResponse('Method not allowed', 405);
        
      default:
        return errorResponse('Not found', 404);
    }
  } catch (error) {
    console.error('[Auth] Error:', error.message);
    return errorResponse('Authentication error', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════════════

async function handleLogin(request, env) {
  const { email, password } = await request.json();
  
  if (!email || !password) {
    return errorResponse('Email and password required');
  }
  
  // Find user
  const user = await env.DB.prepare(`
    SELECT * FROM users WHERE email = ? AND is_active = 1
  `).bind(email.toLowerCase()).first();
  
  if (!user) {
    return errorResponse('Invalid credentials', 401);
  }
  
  // Verify password
  const validPassword = await verifyPassword(password, user.password_hash);
  
  if (!validPassword) {
    return errorResponse('Invalid credentials', 401);
  }
  
  // Create session
  const { token, expiresAt } = await createSession(user.user_id, env);
  
  // Update last login
  await env.DB.prepare(`
    UPDATE users SET last_login = datetime('now') WHERE user_id = ?
  `).bind(user.user_id).run();
  
  // Log analytics
  await logAuthEvent('login', user.user_id, request, env);
  
  return jsonResponse({
    success: true,
    token,
    expiresAt,
    user: {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// REGISTER
// ═════════════════════════════════════════════════════════════════

async function handleRegister(request, env) {
  const { email, password, name, role } = await request.json();
  
  // Validation
  if (!email || !password || !name) {
    return errorResponse('Email, password, and name required');
  }
  
  if (password.length < 6) {
    return errorResponse('Password must be at least 6 characters');
  }
  
  if (!isValidEmail(email)) {
    return errorResponse('Invalid email format');
  }
  
  // Check if user exists
  const existing = await env.DB.prepare(`
    SELECT email FROM users WHERE email = ?
  `).bind(email.toLowerCase()).first();
  
  if (existing) {
    return errorResponse('Email already registered');
  }
  
  // Create user
  const userId = generateUserId();
  const passwordHash = await hashPassword(password);
  
  await env.DB.prepare(`
    INSERT INTO users (user_id, email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(userId, email.toLowerCase(), passwordHash, name, role || 'agent').run();
  
  // Create session
  const { token, expiresAt } = await createSession(userId, env);
  
  // Log analytics
  await logAuthEvent('register', userId, request, env);
  
  return jsonResponse({
    success: true,
    token,
    expiresAt,
    user: {
      userId,
      email: email.toLowerCase(),
      name,
      role: role || 'agent',
    },
  }, 201);
}

// ═════════════════════════════════════════════════════════════════
// LOGOUT
// ═════════════════════════════════════════════════════════════════

async function handleLogout(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await destroySession(token, env);
  }
  
  return jsonResponse({ success: true, message: 'Logged out' });
}

// ═════════════════════════════════════════════════════════════════
// GET CURRENT USER
// ═════════════════════════════════════════════════════════════════

async function handleMe(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }
  
  const token = authHeader.slice(7);
  
  const session = await env.DB.prepare(`
    SELECT u.user_id, u.email, u.name, u.role, u.avatar, u.last_login
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).bind(token).first();
  
  if (!session) {
    return errorResponse('Session expired', 401);
  }
  
  return jsonResponse({
    user: {
      userId: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
      avatar: session.avatar,
      lastLogin: session.last_login,
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═════════════════════════════════════════════════════════════════

async function handleRefresh(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }
  
  const oldToken = authHeader.slice(7);
  
  // Validate current session
  const session = await env.DB.prepare(`
    SELECT s.user_id, u.is_active
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(oldToken).first();
  
  if (!session || !session.is_active) {
    return errorResponse('Invalid session', 401);
  }
  
  // Delete old session
  await destroySession(oldToken, env);
  
  // Create new session
  const { token, expiresAt } = await createSession(session.user_id, env);
  
  return jsonResponse({ token, expiresAt });
}

// ═════════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ═════════════════════════════════════════════════════════════════

async function handleChangePassword(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Unauthorized', 401);
  }
  
  const token = authHeader.slice(7);
  const { currentPassword, newPassword } = await request.json();
  
  if (!currentPassword || !newPassword) {
    return errorResponse('Current and new password required');
  }
  
  if (newPassword.length < 6) {
    return errorResponse('New password must be at least 6 characters');
  }
  
  // Get user from session
  const session = await env.DB.prepare(`
    SELECT u.user_id, u.password_hash
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first();
  
  if (!session) {
    return errorResponse('Session expired', 401);
  }
  
  // Verify current password
  const validPassword = await verifyPassword(currentPassword, session.password_hash);
  
  if (!validPassword) {
    return errorResponse('Current password is incorrect');
  }
  
  // Update password
  const newHash = await hashPassword(newPassword);
  await env.DB.prepare(`
    UPDATE users SET password_hash = ? WHERE user_id = ?
  `).bind(newHash, session.user_id).run();
  
  // Destroy all sessions (force re-login)
  await destroyAllSessions(session.user_id, env);
  
  // Create new session
  const newSession = await createSession(session.user_id, env);
  
  return jsonResponse({
    success: true,
    message: 'Password changed',
    token: newSession.token,
    expiresAt: newSession.expiresAt,
  });
}

// ═════════════════════════════════════════════════════════════════
// FORGOT PASSWORD (Placeholder - needs email service)
// ═════════════════════════════════════════════════════════════════

async function handleForgotPassword(request, env) {
  const { email } = await request.json();
  
  if (!email) {
    return errorResponse('Email required');
  }
  
  // Always return success to prevent email enumeration
  return jsonResponse({
    success: true,
    message: 'If an account exists with this email, you will receive a password reset link.',
  });
}

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function generateUserId() {
  return 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function logAuthEvent(event, userId, request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, data, created_at)
    VALUES ('auth', ?, ?, datetime('now'))
  `).bind(event, JSON.stringify({ userId, ip, userAgent })).run().catch(() => {});
}