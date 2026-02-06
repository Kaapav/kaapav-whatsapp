/**
 * ════════════════════════════════════════════════════════════════
 * OFFLINE SUPPORT
 * IndexedDB and offline queue management
 * ════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB SETUP
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'kaapav-offline';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize IndexedDB
 */
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Pending actions queue
      if (!database.objectStoreNames.contains('pendingActions')) {
        database.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
      
      // Cached data
      if (!database.objectStoreNames.contains('cache')) {
        const cacheStore = database.createObjectStore('cache', { keyPath: 'key' });
        cacheStore.createIndex('expiry', 'expiry');
      }
      
      // Draft messages
      if (!database.objectStoreNames.contains('drafts')) {
        database.createObjectStore('drafts', { keyPath: 'phone' });
      }
    };
  });
}

/**
 * Get database instance
 */
async function getDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

// ═══════════════════════════════════════════════════════════════
// PENDING ACTIONS QUEUE
// ═══════════════════════════════════════════════════════════════

/**
 * Add action to offline queue
 */
export async function queueAction(action) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    
    const request = store.add({
      ...action,
      timestamp: Date.now(),
    });
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending actions
 */
export async function getPendingActions() {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingActions'], 'readonly');
    const store = transaction.objectStore('pendingActions');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove action from queue
 */
export async function removeAction(id) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Process pending actions when back online
 */
export async function processPendingActions(apiHandler) {
  const actions = await getPendingActions();
  const results = [];
  
  for (const action of actions) {
    try {
      await apiHandler(action);
      await removeAction(action.id);
      results.push({ id: action.id, success: true });
    } catch (error) {
      results.push({ id: action.id, success: false, error: error.message });
    }
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════
// DATA CACHING
// ═══════════════════════════════════════════════════════════════

/**
 * Set cached data
 */
export async function setCache(key, data, ttlMinutes = 60) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    
    const request = store.put({
      key,
      data,
      expiry: Date.now() + (ttlMinutes * 60 * 1000),
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get cached data
 */
export async function getCache(key) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result;
      
      if (!result) {
        resolve(null);
        return;
      }
      
      // Check expiry
      if (result.expiry < Date.now()) {
        // Expired, delete and return null
        deleteCache(key);
        resolve(null);
        return;
      }
      
      resolve(result.data);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete cached data
 */
export async function deleteCache(key) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const request = store.delete(key);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache() {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('expiry');
    const range = IDBKeyRange.upperBound(Date.now());
    
    const request = index.openCursor(range);
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════
// DRAFT MESSAGES
// ═══════════════════════════════════════════════════════════════

/**
 * Save draft message
 */
export async function saveDraft(phone, message) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');
    
    const request = store.put({
      phone,
      message,
      timestamp: Date.now(),
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get draft message
 */
export async function getDraft(phone) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['drafts'], 'readonly');
    const store = transaction.objectStore('drafts');
    const request = store.get(phone);
    
    request.onsuccess = () => resolve(request.result?.message || '');
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete draft message
 */
export async function deleteDraft(phone) {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');
    const request = store.delete(phone);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════
// ONLINE/OFFLINE DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Add online/offline listeners
 */
export function addNetworkListeners(onOnline, onOffline) {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

// Auto-initialize
if (typeof window !== 'undefined') {
  initDB().catch(console.error);
  
  // Clear expired cache on init
  clearExpiredCache().catch(console.error);
}