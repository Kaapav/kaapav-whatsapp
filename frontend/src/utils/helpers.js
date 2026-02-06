/**
 * ═══════════════════════════════════════════════════════════════
 * UTILITY HELPERS - Common Functions (FIXED)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Get initials from name
 */
export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Format currency (INR)
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === undefined || amount === null) return '';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format relative time (e.g., "2 min ago", "Yesterday")
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours} hr`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
};

/**
 * Format time only (e.g., "10:30 AM")
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';

  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format date (e.g., "Today", "Yesterday", "Oct 15")
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Format full datetime
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return `Today, ${formatTime(timestamp)}`;
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Get greeting based on time of day
 */
export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

/**
 * Group messages by date - FIXED VERSION
 * ✅ Handles undefined, null, non-arrays safely
 * ✅ Prevents minification issues
 */
export const groupMessagesByDate = (messagesList) => {
  // ✅ CRITICAL: Renamed parameter to avoid minification conflicts
  // Create a new variable to work with
  const messagesToGroup = messagesList;
  
  // ✅ Comprehensive safety checks
  if (!messagesToGroup) {
    return {};
  }
  
  if (!Array.isArray(messagesToGroup)) {
    console.warn('groupMessagesByDate: expected array, got:', typeof messagesToGroup);
    return {};
  }
  
  if (messagesToGroup.length === 0) {
    return {};
  }

  const groupedByDate = {};

  // ✅ Use try-catch to handle any runtime errors
  try {
    messagesToGroup.forEach((msg) => {
      // ✅ Skip invalid messages
      if (!msg || !msg.timestamp) {
        return;
      }
      
      try {
        const dateKey = new Date(msg.timestamp).toDateString();
        
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        
        groupedByDate[dateKey].push(msg);
      } catch (err) {
        console.warn('Error processing message:', err);
      }
    });
  } catch (err) {
    console.error('groupMessagesByDate error:', err);
    return {};
  }

  return groupedByDate;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Format phone number for display
 */
export const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  
  // Remove country code for display
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    const number = digits.slice(2);
    return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
  }
  
  return phone;
};

/**
 * Generate random ID
 */
export const generateId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Copy to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
};

/**
 * Parse JSON safely
 */
export const safeJsonParse = (str, defaultValue = null) => {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * Check if URL is valid image
 */
export const isValidImageUrl = (url) => {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) ||
         url.includes('unsplash.com') ||
         url.includes('cloudinary.com') ||
         url.includes('imgix.net');
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, length = 50) => {
  if (!text || text.length <= length) return text;
  return text.slice(0, length) + '...';
};

/**
 * Escape HTML to prevent XSS
 */
export const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Calculate discount percentage
 */
export const calculateDiscount = (price, comparePrice) => {
  if (!price || !comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
};

/**
 * Validate email
 */
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate Indian phone number
 */
export const isValidPhone = (phone) => {
  const digits = phone?.replace(/\D/g, '') || '';
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};