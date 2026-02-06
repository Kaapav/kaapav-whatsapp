/**
 * Session-based authentication using database
 */

export function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(userId, env) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  console.log('[Session] Creating for user:', userId);
  console.log('[Session] Token:', token.substring(0, 20) + '...');
  console.log('[Session] Expires:', expiresAt);
  
  await env.DB.prepare(\
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, datetime('now'))
  \).bind(token, userId, expiresAt).run();
  
  console.log('[Session] ✅ Saved to database');
  
  return { token, expiresAt };
}

export async function validateSession(token, env) {
  console.log('[Session] Validating:', token.substring(0, 15) + '...');
  
  const session = await env.DB.prepare(\
    SELECT 
      s.token,
      s.user_id,
      s.expires_at,
      u.email,
      u.name,
      u.role,
      u.is_active
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1
  \).bind(token).first();
  
  if (session) {
    console.log('[Session] ✅ Valid:', session.email);
  } else {
    console.log('[Session] ❌ Invalid or expired');
  }
  
  return session;
}
