/**
 * ════════════════════════════════════════════════════════════════
 * API CLIENT
 * Centralized API communication with offline support
 * ════════════════════════════════════════════════════════════════
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://kaapav-api.workers.dev';

// ═══════════════════════════════════════════════════════════════
// BASE FETCH FUNCTION
// ═══════════════════════════════════════════════════════════════

async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };
  
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Handle 401 - Unauthorized
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    // Check if offline
    if (!navigator.onLine) {
      throw new Error('You are offline');
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════════════════════════

export const auth = {
  login: (email, password) => 
    fetchAPI('/api/auth/login', { method: 'POST', body: { email, password } }),
  
  logout: () => 
    fetchAPI('/api/auth/logout', { method: 'POST' }),
  
  me: () => 
    fetchAPI('/api/auth/me'),
  
  changePassword: (currentPassword, newPassword) =>
    fetchAPI('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
};

// ═══════════════════════════════════════════════════════════════
// STATS API
// ═══════════════════════════════════════════════════════════════

export const stats = {
  getDashboard: () => 
    fetchAPI('/api/stats'),
  
  getAnalytics: (type, period) => 
    fetchAPI(`/api/analytics?type=${type}&period=${period}`),
};

// ═══════════════════════════════════════════════════════════════
// CHATS API
// ═══════════════════════════════════════════════════════════════

export const chats = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/chats${query ? `?${query}` : ''}`);
  },
  
  getOne: (phone) => 
    fetchAPI(`/api/chats/${phone}`),
  
  getMessages: (phone, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/chats/${phone}/messages${query ? `?${query}` : ''}`);
  },
  
  markAsRead: (phone) => 
    fetchAPI(`/api/chats/${phone}/read`, { method: 'POST' }),
  
  update: (phone, data) => 
    fetchAPI(`/api/chats/${phone}`, { method: 'PUT', body: data }),
  
  assign: (phone, agentId) => 
    fetchAPI(`/api/chats/${phone}/assign`, { method: 'POST', body: { agentId } }),
  
  toggleBot: (phone) => 
    fetchAPI(`/api/chats/${phone}/toggle-bot`, { method: 'POST' }),
  
  updateLabels: (phone, labels) => 
    fetchAPI(`/api/chats/${phone}/labels`, { method: 'POST', body: { labels } }),
};

// ═══════════════════════════════════════════════════════════════
// MESSAGES API
// ═══════════════════════════════════════════════════════════════

export const messages = {
  send: (phone, type, content) => 
    fetchAPI('/api/messages/send', { method: 'POST', body: { phone, type, ...content } }),
  
  sendTemplate: (phone, templateName, params) => 
    fetchAPI('/api/messages/send-template', { method: 'POST', body: { phone, templateName, params } }),
  
  getQuickReplies: (category) => 
    fetchAPI(`/api/messages/quick-replies${category ? `?category=${category}` : ''}`),
};

// ═══════════════════════════════════════════════════════════════
// ORDERS API
// ═══════════════════════════════════════════════════════════════

export const orders = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/orders${query ? `?${query}` : ''}`);
  },
  
  getOne: (orderId) => 
    fetchAPI(`/api/orders/${orderId}`),
  
  getStats: (period) => 
    fetchAPI(`/api/orders/stats?period=${period || 'today'}`),
  
  create: (data) => 
    fetchAPI('/api/orders', { method: 'POST', body: data }),
  
  update: (orderId, data) => 
    fetchAPI(`/api/orders/${orderId}`, { method: 'PUT', body: data }),
  
  confirm: (orderId) => 
    fetchAPI(`/api/orders/${orderId}/confirm`, { method: 'POST' }),
  
  ship: (orderId, data) => 
    fetchAPI(`/api/orders/${orderId}/ship`, { method: 'POST', body: data }),
  
  cancel: (orderId, reason) => 
    fetchAPI(`/api/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  
  generatePaymentLink: (orderId) => 
    fetchAPI(`/api/orders/${orderId}/payment-link`, { method: 'POST' }),
  
  sendNotification: (orderId, type) => 
    fetchAPI(`/api/orders/${orderId}/send-notification`, { method: 'POST', body: { type } }),
};

// ═══════════════════════════════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════════════════════════════

export const products = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/products${query ? `?${query}` : ''}`);
  },
  
  getOne: (sku) => 
    fetchAPI(`/api/products/${sku}`),
  
  getCategories: () => 
    fetchAPI('/api/products/categories'),
  
  getLowStock: (threshold) => 
    fetchAPI(`/api/products/low-stock?threshold=${threshold || 10}`),
  
  create: (data) => 
    fetchAPI('/api/products', { method: 'POST', body: data }),
  
  update: (sku, data) => 
    fetchAPI(`/api/products/${sku}`, { method: 'PUT', body: data }),
  
  delete: (sku) => 
    fetchAPI(`/api/products/${sku}`, { method: 'DELETE' }),
  
  updateStock: (sku, action, quantity, reason) => 
    fetchAPI(`/api/products/${sku}/stock`, { method: 'POST', body: { action, quantity, reason } }),
};

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS API
// ═══════════════════════════════════════════════════════════════

export const customers = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/customers${query ? `?${query}` : ''}`);
  },
  
  getOne: (phone) => 
    fetchAPI(`/api/customers/${phone}`),
  
  update: (phone, data) => 
    fetchAPI(`/api/customers/${phone}`, { method: 'PUT', body: data }),
};

// ═══════════════════════════════════════════════════════════════
// BROADCASTS API
// ═══════════════════════════════════════════════════════════════

export const broadcasts = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/broadcasts${query ? `?${query}` : ''}`);
  },
  
  getOne: (broadcastId) => 
    fetchAPI(`/api/broadcasts/${broadcastId}`),
  
  create: (data) => 
    fetchAPI('/api/broadcasts', { method: 'POST', body: data }),
  
  update: (broadcastId, data) => 
    fetchAPI(`/api/broadcasts/${broadcastId}`, { method: 'PUT', body: data }),
  
  delete: (broadcastId) => 
    fetchAPI(`/api/broadcasts/${broadcastId}`, { method: 'DELETE' }),
  
  start: (broadcastId) => 
    fetchAPI(`/api/broadcasts/${broadcastId}/send`, { method: 'POST' }),
  
  pause: (broadcastId) => 
    fetchAPI(`/api/broadcasts/${broadcastId}/pause`, { method: 'POST' }),
  
  resume: (broadcastId) => 
    fetchAPI(`/api/broadcasts/${broadcastId}/resume`, { method: 'POST' }),
  
  getRecipients: (broadcastId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/broadcasts/${broadcastId}/recipients${query ? `?${query}` : ''}`);
  },
  
  previewTargets: (targetType, targetLabels, targetSegment, targetFilters) => 
    fetchAPI('/api/broadcasts/preview', { method: 'POST', body: { targetType, targetLabels, targetSegment, targetFilters } }),
};

// ═══════════════════════════════════════════════════════════════
// LABELS API
// ═══════════════════════════════════════════════════════════════

export const labels = {
  getAll: () => 
    fetchAPI('/api/labels'),
  
  create: (name, color, description) => 
    fetchAPI('/api/labels', { method: 'POST', body: { name, color, description } }),
  
  delete: (id) => 
    fetchAPI(`/api/labels/${id}`, { method: 'DELETE' }),
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATES API
// ═══════════════════════════════════════════════════════════════

export const templates = {
  getAll: () => 
    fetchAPI('/api/templates'),
  
  create: (data) => 
    fetchAPI('/api/templates', { method: 'POST', body: data }),
};

// ═══════════════════════════════════════════════════════════════
// QUICK REPLIES API
// ═══════════════════════════════════════════════════════════════

export const quickReplies = {
  getAll: () => 
    fetchAPI('/api/quick-replies'),
  
  create: (data) => 
    fetchAPI('/api/quick-replies', { method: 'POST', body: data }),
  
  delete: (id) => 
    fetchAPI(`/api/quick-replies/${id}`, { method: 'DELETE' }),
};

// ═══════════════════════════════════════════════════════════════
// SHIPPING API
// ═══════════════════════════════════════════════════════════════

export const shipping = {
  checkServiceability: (pickupPincode, deliveryPincode, weight, cod) => 
    fetchAPI('/api/shipping/check', { method: 'POST', body: { pickupPincode, deliveryPincode, weight, cod } }),
  
  getCouriers: (pickupPincode, deliveryPincode, weight, cod) => 
    fetchAPI(`/api/shipping/couriers?pickup=${pickupPincode}&delivery=${deliveryPincode}&weight=${weight}&cod=${cod}`),
  
  createShipment: (orderId, courierId) => 
    fetchAPI('/api/shipping/create', { method: 'POST', body: { orderId, courierId } }),
  
  track: (awb) => 
    fetchAPI(`/api/shipping/track/${awb}`),
  
  getLabel: (shipmentId) => 
    fetchAPI(`/api/shipping/label/${shipmentId}`),
};

// ═══════════════════════════════════════════════════════════════
// SETTINGS API
// ═══════════════════════════════════════════════════════════════

export const settings = {
  get: () => 
    fetchAPI('/api/settings'),
  
  update: (data) => 
    fetchAPI('/api/settings', { method: 'PUT', body: data }),
};

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS API
// ═══════════════════════════════════════════════════════════════

export const push = {
  subscribe: (subscription) => 
    fetchAPI('/api/push/subscribe', { method: 'POST', body: subscription }),
};

// Export all
export default {
  auth,
  stats,
  chats,
  messages,
  orders,
  products,
  customers,
  broadcasts,
  labels,
  templates,
  quickReplies,
  shipping,
  settings,
  push,
};