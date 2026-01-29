/**
 * ════════════════════════════════════════════════════════════════
 * ZUSTAND STORE
 * Global state management
 * ════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api';

// ═══════════════════════════════════════════════════════════════
// AUTH STORE
// ═══════════════════════════════════════════════════════════════

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      
      login: async (email, password) => {
        try {
          const data = await api.auth.login(email, password);
          
          localStorage.setItem('token', data.token);
          
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      
      logout: async () => {
        try {
          await api.auth.logout();
        } catch {} finally {
          localStorage.removeItem('token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },
      
      checkAuth: async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }
        
        try {
          const data = await api.auth.me();
          set({
            user: data.user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          localStorage.removeItem('token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

// ═══════════════════════════════════════════════════════════════
// CHAT STORE
// ═══════════════════════════════════════════════════════════════

export const useChatStore = create((set, get) => ({
  chats: [],
  currentChat: null,
  messages: [],
  unreadCount: 0,
  isLoading: false,
  hasMore: true,
  
  fetchChats: async (params = {}) => {
    set({ isLoading: true });
    try {
      const data = await api.chats.getAll(params);
      set({
        chats: data.chats,
        unreadCount: data.unread,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  fetchChat: async (phone) => {
    set({ isLoading: true });
    try {
      const data = await api.chats.getOne(phone);
      set({ currentChat: data, isLoading: false });
      return data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  fetchMessages: async (phone, before = null) => {
    try {
      const params = before ? { before } : {};
      const data = await api.chats.getMessages(phone, params);
      
      set(state => ({
        messages: before 
          ? [...data.messages, ...state.messages]
          : data.messages,
        hasMore: data.hasMore,
      }));
      
      return data;
    } catch (error) {
      throw error;
    }
  },
  
  addMessage: (message) => {
    set(state => ({
      messages: [...state.messages, message],
    }));
  },
  
  updateMessage: (messageId, updates) => {
    set(state => ({
      messages: state.messages.map(m => 
        m.messageId === messageId ? { ...m, ...updates } : m
      ),
    }));
  },
  
  markAsRead: async (phone) => {
    try {
      await api.chats.markAsRead(phone);
      set(state => ({
        chats: state.chats.map(c => 
          c.phone === phone ? { ...c, unreadCount: 0 } : c
        ),
        unreadCount: Math.max(0, state.unreadCount - (state.chats.find(c => c.phone === phone)?.unreadCount || 0)),
      }));
    } catch {}
  },
  
  clearMessages: () => {
    set({ messages: [], hasMore: true });
  },
  
  clearCurrentChat: () => {
    set({ currentChat: null, messages: [], hasMore: true });
  },
}));

// ═══════════════════════════════════════════════════════════════
// ORDER STORE
// ═══════════════════════════════════════════════════════════════

export const useOrderStore = create((set, get) => ({
  orders: [],
  currentOrder: null,
  stats: null,
  total: 0,
  isLoading: false,
  
  fetchOrders: async (params = {}) => {
    set({ isLoading: true });
    try {
      const data = await api.orders.getAll(params);
      set({
        orders: data.orders,
        total: data.total,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  fetchOrder: async (orderId) => {
    set({ isLoading: true });
    try {
      const data = await api.orders.getOne(orderId);
      set({ currentOrder: data, isLoading: false });
      return data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  fetchStats: async (period = 'today') => {
    try {
      const data = await api.orders.getStats(period);
      set({ stats: data });
      return data;
    } catch (error) {
      throw error;
    }
  },
  
  updateOrder: async (orderId, updates) => {
    try {
      await api.orders.update(orderId, updates);
      set(state => ({
        orders: state.orders.map(o => 
          o.orderId === orderId ? { ...o, ...updates } : o
        ),
        currentOrder: state.currentOrder?.order?.orderId === orderId 
          ? { ...state.currentOrder, order: { ...state.currentOrder.order, ...updates } }
          : state.currentOrder,
      }));
    } catch (error) {
      throw error;
    }
  },
  
  clearCurrentOrder: () => {
    set({ currentOrder: null });
  },
}));

// ═══════════════════════════════════════════════════════════════
// PRODUCT STORE
// ═══════════════════════════════════════════════════════════════

export const useProductStore = create((set, get) => ({
  products: [],
  categories: [],
  currentProduct: null,
  total: 0,
  isLoading: false,
  
  fetchProducts: async (params = {}) => {
    set({ isLoading: true });
    try {
      const data = await api.products.getAll(params);
      set({
        products: data.products,
        total: data.total,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  fetchCategories: async () => {
    try {
      const data = await api.products.getCategories();
      set({ categories: data.categories });
    } catch {}
  },
  
  fetchProduct: async (sku) => {
    set({ isLoading: true });
    try {
      const data = await api.products.getOne(sku);
      set({ currentProduct: data, isLoading: false });
      return data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  updateProduct: async (sku, updates) => {
    try {
      await api.products.update(sku, updates);
      set(state => ({
        products: state.products.map(p => 
          p.sku === sku ? { ...p, ...updates } : p
        ),
      }));
    } catch (error) {
      throw error;
    }
  },
  
  clearCurrentProduct: () => {
    set({ currentProduct: null });
  },
}));

// ═══════════════════════════════════════════════════════════════
// UI STORE
// ═══════════════════════════════════════════════════════════════

export const useUIStore = create((set) => ({
  isOnline: navigator.onLine,
  showQuickReplies: false,
  showMediaPicker: false,
  activeTab: 'dashboard',
  
  setOnline: (isOnline) => set({ isOnline }),
  setShowQuickReplies: (show) => set({ showQuickReplies: show }),
  setShowMediaPicker: (show) => set({ showMediaPicker: show }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useUIStore.getState().setOnline(true));
  window.addEventListener('offline', () => useUIStore.getState().setOnline(false));
}