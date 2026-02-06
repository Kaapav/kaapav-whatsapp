/**
 * ════════════════════════════════════════════════════════════════
 * AUTHENTICATION MIDDLEWARE
 * JWT-based authentication with session management
 * ════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════
// TOKEN GENERATION & VALIDATION
// ═════════════════════════════════════════════════════════════════

export async function generateToken(payload, secret, expiresIn = '7d') {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const exp = Math.floor(Date.now() / 1000) + parseExpiry(expiresIn);
  const tokenPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
    if (signature !== expectedSignature) return null;
    
    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
// PASSWORD HASHING
// ═════════════════════════════════════════════════════════════════

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// ═════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═════════════════════════════════════════════════════════════════

export async function createSession(userId, env, expiresInDays = 7) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  
  await env.DB.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(token, userId, expiresAt).run();
  
  // Clean old sessions
  await env.DB.prepare(`
    DELETE FROM sessions 
    WHERE user_id = ? AND expires_at < datetime('now')
  `).bind(userId).run();
  
  return { token, expiresAt };
}

export async function validateSession(token, env) {
  const session = await env.DB.prepare(`
    SELECT s.*, u.role, u.name, u.email, u.avatar
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  `).bind(token).first();
  
  return session;
}

export async function destroySession(token, env) {
  await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
}

export async function destroyAllSessions(userId, env) {
  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
}

// ═════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═════════════════════════════════════════════════════════════════

export async function authMiddleware(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'No token provided' };
  }
  
  const token = authHeader.slice(7);
  
  // Check API key first
  if (env.API_KEY && token === env.API_KEY) {
    return {
      authenticated: true,
      user: { type: 'api_key', role: 'admin', userId: 'api' },
    };
  }
  
  // Validate session
  const session = await validateSession(token, env);
  
  if (!session) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }
  
  return {
    authenticated: true,
    user: {
      type: 'session',
      userId: session.user_id,
      role: session.role,
      name: session.name,
      email: session.email,
      avatar: session.avatar,
    },
  };
}

// ═════════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS
// ═════════════════════════════════════════════════════════════════

export function requireRole(user, allowedRoles) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return allowedRoles.includes(user.role);
}

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  VIEWER: 'viewer',
};

export const PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.MANAGER]: ['chats', 'orders', 'products', 'customers', 'broadcasts', 'analytics'],
  [ROLES.AGENT]: ['chats', 'orders', 'customers'],
  [ROLES.VIEWER]: ['chats:read', 'orders:read', 'analytics:read'],
};

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60; // Default 7 days
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 7 * 24 * 60 * 60;
  }
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}