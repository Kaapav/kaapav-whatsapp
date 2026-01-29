/**
 * ════════════════════════════════════════════════════════════════
 * HELPER FUNCTIONS
 * Utility functions for the app
 * ════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Format phone number
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.toString().replace(/\D/g, '');
  
  // Indian phone format
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  
  return phone;
}

/**
 * Format relative time
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return then.toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short' 
  });
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validate email
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone (Indian)
 */
export function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return /^(91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validate pincode (Indian)
 */
export function isValidPincode(pincode) {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

// ═══════════════════════════════════════════════════════════════
// STRING UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Truncate string
 */
export function truncate(str, length = 50) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Get initials from name
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate random ID
 */
export function generateId(prefix = '') {
  return prefix + Math.random().toString(36).substring(2, 10);
}

// ═══════════════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get color for status
 */
export function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    confirmed: 'info',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger',
    paid: 'success',
    unpaid: 'danger',
    new: 'info',
    returning: 'success',
    loyal: 'primary',
    vip: 'primary',
  };
  return colors[status] || 'gray';
}

/**
 * Get tier color
 */
export function getTierGradient(tier) {
  const gradients = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-400 to-cyan-600',
    diamond: 'from-purple-400 to-pink-500',
  };
  return gradients[tier] || 'from-dark-300 to-dark-400';
}

// ═══════════════════════════════════════════════════════════════
// ARRAY UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Group array by key
 */
export function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const value = item[key];
    groups[value] = groups[value] || [];
    groups[value].push(item);
    return groups;
  }, {});
}

/**
 * Sort array by key
 */
export function sortBy(array, key, order = 'asc') {
  return [...array].sort((a, b) => {
    if (order === 'asc') {
      return a[key] > b[key] ? 1 : -1;
    }
    return a[key] < b[key] ? 1 : -1;
  });
}

/**
 * Remove duplicates
 */
export function unique(array, key) {
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const val = item[key];
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
  return [...new Set(array)];
}

// ═══════════════════════════════════════════════════════════════
// DEBOUNCE & THROTTLE
// ═══════════════════════════════════════════════════════════════

/**
 * Debounce function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════

/**
 * Safe localStorage get
 */
export function getStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safe localStorage set
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove from localStorage
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// CLIPBOARD
// ═══════════════════════════════════════════════════════════════

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// URL UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Parse query string
 */
export function parseQueryString(queryString) {
  const params = new URLSearchParams(queryString);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Build query string
 */
export function buildQueryString(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}