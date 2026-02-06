/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV STORE - Zustand with Persistence & Real-time
 * ═══════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';

// ═══════════════════════════════════════════════════════════════
// AUTH STORE
// ═══════════════════════════════════════════════════════════════
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null,
      biometricEnabled: false,
      biometricCredentialId: null,
      
      // Actions
      setAuth: (user, token, expiresAt) => set({
        isAuthenticated: true,
        user,
        token,
        expiresAt,
      }),
      
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          expiresAt: null,
        });
        // Clear other stores
        useChatStore.getState().reset();
        useOrderStore.getState().reset();
      },
      
      enableBiometric: (credentialId) => set({
        biometricEnabled: true,
        biometricCredentialId: credentialId,
      }),
      
      disableBiometric: () => set({
        biometricEnabled: false,
        biometricCredentialId: null,
      }),
      
      isTokenValid: () => {
  const { expiresAt, isAuthenticated } = get();
  if (!expiresAt) return isAuthenticated; // Allow if authenticated even without expiry
  return new Date(expiresAt) > new Date();
},
    }),
    {
      name: 'kaapav-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        expiresAt: state.expiresAt,
        biometricEnabled: state.biometricEnabled,
        biometricCredentialId: state.biometricCredentialId,
      }),
    }
  )
);

// ═══════════════════════════════════════════════════════════════
// CHAT STORE
// ═══════════════════════════════════════════════════════════════
export const useChatStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State
        chats: [],
        currentChatPhone: null,
        messages: {},  // { [phone]: Message[] }
        typingStatus: {}, // { [phone]: boolean }
        onlineStatus: {}, // { [phone]: 'online' | 'away' | 'offline' }
        unreadTotal: 0,
        isLoading: false,
        lastSync: null,
        
        // Actions
        setChats: (chats) => {
          const unreadTotal = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);
          set({ chats, unreadTotal, lastSync: new Date().toISOString() });
        },
        
        updateChat: (phone, updates) => set((state) => ({
          chats: state.chats.map((c) =>
            c.phone === phone ? { ...c, ...updates } : c
          ),
        })),
        
        addChat: (chat) => set((state) => ({
          chats: [chat, ...state.chats.filter((c) => c.phone !== chat.phone)],
        })),
        
        setCurrentChat: (phone) => set({ currentChatPhone: phone }),
        
        setMessages: (phone, messages) => set((state) => ({
          messages: { ...state.messages, [phone]: messages },
        })),
        
        addMessage: (phone, message) => set((state) => {
          const existing = state.messages[phone] || [];
          // Avoid duplicates
          if (existing.find((m) => m.message_id === message.message_id)) {
            return state;
          }
          return {
            messages: {
              ...state.messages,
              [phone]: [...existing, message],
            },
          };
        }),
        
        updateMessageStatus: (phone, messageId, status) => set((state) => ({
          messages: {
            ...state.messages,
            [phone]: (state.messages[phone] || []).map((m) =>
              m.message_id === messageId ? { ...m, status } : m
            ),
          },
        })),
        
        setTyping: (phone, isTyping) => set((state) => ({
          typingStatus: { ...state.typingStatus, [phone]: isTyping },
        })),
        
        setOnline: (phone, status) => set((state) => ({
          onlineStatus: { ...state.onlineStatus, [phone]: status },
        })),
        
        markAsRead: (phone) => set((state) => ({
          chats: state.chats.map((c) =>
            c.phone === phone ? { ...c, unread_count: 0 } : c
          ),
          unreadTotal: state.chats.reduce(
            (sum, c) => sum + (c.phone === phone ? 0 : c.unread_count || 0),
            0
          ),
        })),
        
        setLoading: (isLoading) => set({ isLoading }),
        
        reset: () => set({
          chats: [],
          currentChatPhone: null,
          messages: {},
          typingStatus: {},
          onlineStatus: {},
          unreadTotal: 0,
        }),
        
        // Selectors
        getChatByPhone: (phone) => get().chats.find((c) => c.phone === phone),
        getMessages: (phone) => get().messages[phone] || [],
        getCurrentMessages: () => {
          const phone = get().currentChatPhone;
          return phone ? get().messages[phone] || [] : [];
        },
      }),
      {
        name: 'kaapav-chats',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          chats: state.chats?.slice(0, 50), // Only persist latest 50 chats
          lastSync: state.lastSync,
        }),
      }
    )
  )
);

// ═══════════════════════════════════════════════════════════════
// ORDER STORE
// ═══════════════════════════════════════════════════════════════
export const useOrderStore = create(
  persist(
    (set, get) => ({
      // State
      orders: [],
      pendingCount: 0,
      isLoading: false,
      filters: {
        status: 'all',
        search: '',
        dateRange: null,
      },
      
      // Actions
      setOrders: (orders) => {
        const pendingCount = orders.filter((o) => o.status === 'pending').length;
        set({ orders, pendingCount });
      },
      
      updateOrder: (orderId, updates) => set((state) => ({
        orders: state.orders.map((o) =>
          o.order_id === orderId ? { ...o, ...updates } : o
        ),
        pendingCount: state.orders.filter((o) => {
          if (o.order_id === orderId) {
            return updates.status === 'pending';
          }
          return o.status === 'pending';
        }).length,
      })),
      
      addOrder: (order) => set((state) => ({
        orders: [order, ...state.orders],
        pendingCount: state.pendingCount + (order.status === 'pending' ? 1 : 0),
      })),
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      reset: () => set({
        orders: [],
        pendingCount: 0,
        filters: { status: 'all', search: '', dateRange: null },
      }),
      
      // Selectors
      getFilteredOrders: () => {
        const { orders, filters } = get();
        return orders.filter((o) => {
          if (filters.status !== 'all' && o.status !== filters.status) return false;
          if (filters.search) {
            const search = filters.search.toLowerCase();
            return (
              o.order_id?.toLowerCase().includes(search) ||
              o.customer_name?.toLowerCase().includes(search) ||
              o.phone?.includes(search)
            );
          }
          return true;
        });
      },
    }),
    {
      name: 'kaapav-orders',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orders: state.orders?.slice(0, 100),
      }),
    }
  )
);

// ═══════════════════════════════════════════════════════════════
// PRODUCT STORE
// ═══════════════════════════════════════════════════════════════
export const useProductStore = create(
  persist(
    (set, get) => ({
      // State
      products: [],
      categories: [],
      isLoading: false,
      filters: {
        category: 'all',
        search: '',
        inStock: null,
      },
      
      // Actions
      setProducts: (products) => set({ products }),
      setCategories: (categories) => set({ categories }),
      
      updateProduct: (sku, updates) => set((state) => ({
        products: state.products.map((p) =>
          p.sku === sku ? { ...p, ...updates } : p
        ),
      })),
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      // Selectors
      getFilteredProducts: () => {
        const { products, filters } = get();
        return products.filter((p) => {
          if (filters.category !== 'all' && p.category !== filters.category) return false;
          if (filters.inStock === true && p.stock <= 0) return false;
          if (filters.inStock === false && p.stock > 0) return false;
          if (filters.search) {
            const search = filters.search.toLowerCase();
            return (
              p.name?.toLowerCase().includes(search) ||
              p.sku?.toLowerCase().includes(search)
            );
          }
          return true;
        });
      },
      
      getProductBySku: (sku) => get().products.find((p) => p.sku === sku),
    }),
    {
      name: 'kaapav-products',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ═══════════════════════════════════════════════════════════════
// DASHBOARD STORE
// ═══════════════════════════════════════════════════════════════
export const useDashboardStore = create((set) => ({
  stats: null,
  activities: [],
  pendingActions: [],
  isLoading: false,
  
  setStats: (stats) => set({ stats }),
  setActivities: (activities) => set({ activities }),
  setPendingActions: (pendingActions) => set({ pendingActions }),
  setLoading: (isLoading) => set({ isLoading }),
}));

// ═══════════════════════════════════════════════════════════════
// UI STORE
// ═══════════════════════════════════════════════════════════════
export const useUIStore = create((set, get) => ({
  // Toast
  toast: null,
  
  // Modals
  activeModal: null,
  modalData: null,
  
  // Loading
  globalLoading: false,
  
  // Offline
  isOffline: !navigator.onLine,
  pendingActions: [], // Queue for offline actions
  
  // Theme
  theme: 'light',
  
  // Actions
  showToast: (message, type = 'default', duration = 3000) => {
    set({ toast: { message, type, visible: true } });
    setTimeout(() => {
      set({ toast: null });
    }, duration);
  },
  
  hideToast: () => set({ toast: null }),
  
  openModal: (modal, data = null) => set({
    activeModal: modal,
    modalData: data,
  }),
  
  closeModal: () => set({
    activeModal: null,
    modalData: null,
  }),
  
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  
  setOffline: (offline) => set({ isOffline: offline }),
  
  addPendingAction: (action) => set((state) => ({
    pendingActions: [...state.pendingActions, action],
  })),
  
  removePendingAction: (id) => set((state) => ({
    pendingActions: state.pendingActions.filter((a) => a.id !== id),
  })),
  
  clearPendingActions: () => set({ pendingActions: [] }),
  
  setTheme: (theme) => set({ theme }),
}));

// ═══════════════════════════════════════════════════════════════
// QUICK REPLIES & TEMPLATES STORE
// ═══════════════════════════════════════════════════════════════
export const useTemplateStore = create(
  persist(
    (set) => ({
      quickReplies: [],
      templates: [],
      labels: [],
      
      setQuickReplies: (quickReplies) => set({ quickReplies }),
      setTemplates: (templates) => set({ templates }),
      setLabels: (labels) => set({ labels }),
      
      addQuickReply: (reply) => set((state) => ({
        quickReplies: [...state.quickReplies, reply],
      })),
      
      updateQuickReply: (id, updates) => set((state) => ({
        quickReplies: state.quickReplies.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      })),
      
      incrementQuickReplyUse: (shortcut) => set((state) => ({
        quickReplies: state.quickReplies.map((r) =>
          r.shortcut === shortcut ? { ...r, use_count: (r.use_count || 0) + 1 } : r
        ),
      })),
    }),
    {
      name: 'kaapav-templates',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ═══════════════════════════════════════════════════════════════
// SETTINGS STORE
// ═══════════════════════════════════════════════════════════════
export const useSettingsStore = create(
  persist(
    (set) => ({
      // Notifications
      pushEnabled: true,
      soundEnabled: true,
      emailDigestEnabled: false,
      
      // Chat
      aiAutoReply: true,
      showTypingIndicator: true,
      sendReadReceipts: true,
      
      // Display
      compactMode: false,
      showAvatars: true,
      
      // Keyboard Shortcuts
      keyboardShortcuts: true,
      
      // Actions
      updateSetting: (key, value) => set({ [key]: value }),
      
      toggleSetting: (key) => set((state) => ({ [key]: !state[key] })),
    }),
    {
      name: 'kaapav-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
