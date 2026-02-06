/**
 * ════════════════════════════════════════════════════════════════
 * RATE LIMITING MIDDLEWARE
 * Token bucket algorithm with KV storage
 * ════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════
// RATE LIMITER CLASS
// ═════════════════════════════════════════════════════════════════

export class RateLimiter {
  constructor(kv, options = {}) {
    this.kv = kv;
    this.options = {
      prefix: 'rl:',
      defaultLimit: 100,
      defaultWindow: 60,
      ...options,
    };
  }

  /**
   * Check if request is allowed
   * @param {string} key - Unique identifier (IP, user ID, etc.)
   * @param {number} limit - Max requests
   * @param {number} window - Time window in seconds
   * @returns {Promise<{allowed: boolean, remaining: number, reset: number}>}
   */
  async check(key, limit = this.options.defaultLimit, window = this.options.defaultWindow) {
    if (!this.kv) {
      return { allowed: true, remaining: limit, reset: Date.now() + window * 1000 };
    }

    const cacheKey = `${this.options.prefix}${key}`;
    const now = Date.now();
    const windowStart = now - (window * 1000);

    try {
      // Get current state
      const data = await this.kv.get(cacheKey, 'json') || { requests: [], firstRequest: now };
      
      // Filter requests within window
      const validRequests = data.requests.filter(t => t > windowStart);
      
      if (validRequests.length >= limit) {
        const oldestRequest = Math.min(...validRequests);
        const reset = oldestRequest + (window * 1000);
        
        return {
          allowed: false,
          remaining: 0,
          reset,
          retryAfter: Math.ceil((reset - now) / 1000),
        };
      }

      // Add current request
      validRequests.push(now);

      // Save updated state
      await this.kv.put(cacheKey, JSON.stringify({
        requests: validRequests,
        firstRequest: data.firstRequest,
      }), { expirationTtl: window * 2 });

      return {
        allowed: true,
        remaining: limit - validRequests.length,
        reset: now + (window * 1000),
      };
    } catch (error) {
      console.error('[RateLimit] Error:', error.message);
      return { allowed: true, remaining: limit, reset: now + (window * 1000) };
    }
  }

  /**
   * Consume tokens for burst protection
   */
  async consume(key, tokens = 1, limit = 10, refillRate = 1) {
    if (!this.kv) return { allowed: true, tokens: limit };

    const cacheKey = `${this.options.prefix}bucket:${key}`;
    const now = Date.now();

    try {
      const data = await this.kv.get(cacheKey, 'json') || { tokens: limit, lastRefill: now };
      
      // Calculate refill
      const elapsed = (now - data.lastRefill) / 1000;
      const refilled = Math.min(limit, data.tokens + (elapsed * refillRate));
      
      if (refilled < tokens) {
        return { allowed: false, tokens: refilled };
      }

      // Consume tokens
      const newTokens = refilled - tokens;
      await this.kv.put(cacheKey, JSON.stringify({
        tokens: newTokens,
        lastRefill: now,
      }), { expirationTtl: 3600 });

      return { allowed: true, tokens: newTokens };
    } catch (error) {
      return { allowed: true, tokens: limit };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key) {
    if (!this.kv) return;
    await this.kv.delete(`${this.options.prefix}${key}`);
  }
}

// ═════════════════════════════════════════════════════════════════
// PRE-CONFIGURED LIMITERS
// ═════════════════════════════════════════════════════════════════

export const RATE_LIMITS = {
  // API endpoints
  API: { limit: 100, window: 60 },
  
  // Authentication
  LOGIN: { limit: 5, window: 900 },
  REGISTER: { limit: 3, window: 3600 },
  PASSWORD_RESET: { limit: 3, window: 3600 },
  
  // Message sending
  SEND_MESSAGE: { limit: 30, window: 60 },
  SEND_BROADCAST: { limit: 10, window: 60 },
  
  // File uploads
  UPLOAD: { limit: 20, window: 60 },
  
  // Webhooks
  WEBHOOK: { limit: 1000, window: 60 },
};

// ═════════════════════════════════════════════════════════════════
// MIDDLEWARE FUNCTION
// ═════════════════════════════════════════════════════════════════

export async function rateLimitMiddleware(request, env, type = 'API') {
  const limiter = new RateLimiter(env.KV);
  const config = RATE_LIMITS[type] || RATE_LIMITS.API;
  
  // Get identifier
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For')?.split(',')[0] || 
             'unknown';
  
  const key = `${type}:${ip}`;
  const result = await limiter.check(key, config.limit, config.window);
  
  if (!result.allowed) {
    return {
      limited: true,
      response: new Response(JSON.stringify({
        error: 'Too many requests',
        retryAfter: result.retryAfter,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.reset),
          'Retry-After': String(result.retryAfter),
        },
      }),
    };
  }
  
  return {
    limited: false,
    headers: {
      'X-RateLimit-Limit': String(config.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
    },
  };
}

// ═════════════════════════════════════════════════════════════════
// SLIDING WINDOW COUNTER (Alternative Algorithm)
// ═════════════════════════════════════════════════════════════════

export class SlidingWindowRateLimiter {
  constructor(kv) {
    this.kv = kv;
  }

  async isAllowed(key, limit, windowSizeSeconds) {
    if (!this.kv) return { allowed: true };

    const now = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(now / windowSizeSeconds);
    const previousWindow = currentWindow - 1;
    
    const currentKey = `sw:${key}:${currentWindow}`;
    const previousKey = `sw:${key}:${previousWindow}`;

    const [currentCount, previousCount] = await Promise.all([
      this.kv.get(currentKey).then(v => parseInt(v) || 0),
      this.kv.get(previousKey).then(v => parseInt(v) || 0),
    ]);

    // Calculate weighted count
    const elapsedInWindow = now % windowSizeSeconds;
    const weight = (windowSizeSeconds - elapsedInWindow) / windowSizeSeconds;
    const weightedCount = Math.floor(previousCount * weight) + currentCount;

    if (weightedCount >= limit) {
      return { allowed: false, count: weightedCount };
    }

    // Increment counter
    await this.kv.put(currentKey, String(currentCount + 1), {
      expirationTtl: windowSizeSeconds * 2,
    });

    return { allowed: true, count: weightedCount + 1 };
  }
}