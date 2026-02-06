/**
 * ════════════════════════════════════════════════════════════════
 * CORS MIDDLEWARE
 * Complete CORS handling with security features
 * ════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═════════════════════════════════════════════════════════════════

export const DEFAULT_CORS_OPTIONS = {
  origins: ['*'], // In production, specify your domains
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// ═════════════════════════════════════════════════════════════════
// CORS HANDLER
// ═════════════════════════════════════════════════════════════════

export function corsHeaders(origin, options = DEFAULT_CORS_OPTIONS) {
  const headers = new Headers();
  
  // Handle origin
  if (options.origins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && options.origins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  } else if (options.origins.length === 1) {
    headers.set('Access-Control-Allow-Origin', options.origins[0]);
  }
  
  // Methods
  headers.set('Access-Control-Allow-Methods', options.methods.join(', '));
  
  // Headers
  headers.set('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
  
  // Exposed headers
  if (options.exposedHeaders?.length) {
    headers.set('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
  }
  
  // Credentials
  if (options.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // Max age
  headers.set('Access-Control-Max-Age', String(options.maxAge));
  
  return headers;
}

// ═════════════════════════════════════════════════════════════════
// PREFLIGHT HANDLER
// ═════════════════════════════════════════════════════════════════

export function handlePreflight(request, options = DEFAULT_CORS_OPTIONS) {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin, options);
  
  return new Response(null, {
    status: 204,
    headers,
  });
}

// ═════════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ═════════════════════════════════════════════════════════════════

export function corsMiddleware(options = DEFAULT_CORS_OPTIONS) {
  return async (request, next) => {
    const origin = request.headers.get('Origin');
    
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, options);
    }
    
    // Check origin for non-preflight requests
    if (!options.origins.includes('*') && origin && !options.origins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'CORS not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Continue to next handler
    const response = await next(request);
    
    // Add CORS headers to response
    const headers = corsHeaders(origin, options);
    const newResponse = new Response(response.body, response);
    
    for (const [key, value] of headers.entries()) {
      newResponse.headers.set(key, value);
    }
    
    return newResponse;
  };
}

// ═════════════════════════════════════════════════════════════════
// SIMPLE CORS HEADERS OBJECT (For direct use)
// ═════════════════════════════════════════════════════════════════

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// ═════════════════════════════════════════════════════════════════
// RESPONSE HELPERS WITH CORS
// ═════════════════════════════════════════════════════════════════

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function errorResponse(message, status = 400, extraHeaders = {}) {
  return jsonResponse({ error: message }, status, extraHeaders);
}

export function successResponse(data = {}, message = 'Success') {
  return jsonResponse({ success: true, message, ...data });
}