/**
 * ═══════════════════════════════════════════════════════════════
 * CHATS SCREEN - WhatsApp-style Chat List
 * Real-time updates, filters, search, keyboard shortcuts
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChatStore, useUIStore, useSettingsStore } from '../store';
import { chatAPI } from '../api';
import { formatRelativeTime, getInitials } from '../utils/helpers';
import PullToRefresh from '../components/PullToRefresh';
import ChatItem from '../components/ChatItem';

// Filter definitions
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'orders', label: 'Orders' },
  { key: 'vip', label: 'VIP' },
  { key: 'support', label: 'Support' },
  { key: 'starred', label: 'Starred' },
];

function Chats() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Store
  const { chats, setChats, unreadTotal, isLoading, setLoading, markAsRead } = useChatStore();
  const { showToast } = useUIStore();
  const { keyboardShortcuts } = useSettingsStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'all');
  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Refs
  const searchInputRef = useRef(null);
  const chatListRef = useRef(null);

  // Fetch chats
  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chatAPI.getChats();
      if (response?.chats) {
        setChats(response.chats);
        setOnlineCount(response.online_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
      showToast('Failed to load chats', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
    
    // Refresh every 15 seconds
    const interval = setInterval(fetchChats, 15000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return;

    const handleKeyDown = (e) => {
      // Focus search with /
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape to clear search
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredChats.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      // Enter to open chat
      if (e.key === 'Enter' && selectedIndex >= 0) {
        const chat = filteredChats[selectedIndex];
        if (chat) {
          handleChatClick(chat.phone);
        }
        return;
      }

      // Number keys for quick filter
      if (e.key >= '1' && e.key <= '6') {
        const index = parseInt(e.key) - 1;
        if (FILTERS[index]) {
          setActiveFilter(FILTERS[index].key);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcuts, searchQuery, selectedIndex]);

  // Filter and search chats
  const filteredChats = useMemo(() => {
    let result = chats || [];

    // Apply filter
    if (activeFilter !== 'all') {
      result = result.filter((chat) => {
        switch (activeFilter) {
          case 'unread':
            return chat.unread_count > 0;
          case 'orders':
            return chat.labels?.includes('order') || chat.has_active_order;
          case 'vip':
            return chat.labels?.includes('vip') || chat.segment === 'vip';
          case 'support':
            return chat.labels?.includes('support') || chat.priority === 'high';
          case 'starred':
            return chat.is_starred;
          default:
            return true;
        }
      });
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((chat) =>
        chat.customer_name?.toLowerCase().includes(query) ||
        chat.phone?.includes(query) ||
        chat.last_message?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [chats, activeFilter, searchQuery]);

  // Separate pinned and regular chats
  const pinnedChats = useMemo(() => 
    filteredChats.filter((c) => c.is_starred), 
    [filteredChats]
  );
  
  const regularChats = useMemo(() => 
    filteredChats.filter((c) => !c.is_starred), 
    [filteredChats]
  );

  // Get filter counts
  const getFilterCount = (filterKey) => {
    if (!chats?.length) return 0;
    switch (filterKey) {
      case 'all':
        return chats.length;
      case 'unread':
        return chats.filter((c) => c.unread_count > 0).length;
      case 'orders':
        return chats.filter((c) => c.labels?.includes('order') || c.has_active_order).length;
      case 'vip':
        return chats.filter((c) => c.labels?.includes('vip') || c.segment === 'vip').length;
      case 'starred':
        return chats.filter((c) => c.is_starred).length;
      default:
        return 0;
    }
  };

  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setSelectedIndex(-1);
    setSearchParams(filter === 'all' ? {} : { filter });
  };

  // Handle chat click
  const handleChatClick = (phone) => {
    navigate(`/chat/${phone}`);
  };

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    try {
      // This would call an API endpoint
      filteredChats.forEach((chat) => {
        if (chat.unread_count > 0) {
          markAsRead(chat.phone);
        }
      });
      showToast('All chats marked as read', 'success');
    } catch (err) {
      showToast('Failed to mark as read', 'error');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    await fetchChats();
  };

  return (
    <div className="screen">
      {/* Header */}
      <div className="chat-screen-header">
        <div className="chat-header-top">
          <div className="chat-header-brand">
            <div className="brand-icon">
              <i className="fab fa-whatsapp"></i>
            </div>
            <div className="brand-text">
              <div className="brand-name">Chats</div>
              <div className="brand-status">
                <span className="status-dot"></span>
                {onlineCount > 0 ? `Online • ${onlineCount} active` : 'Connecting...'}
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button className="header-btn header-btn-glass" title="Scan QR">
              <i className="fas fa-qrcode"></i>
            </button>
            <button 
              className="header-btn header-btn-glass" 
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <i className="fas fa-bell"></i>
              {unreadTotal > 0 && <span className="notif-dot"></span>}
            </button>
            <button
              className="header-btn header-btn-glass"
              onClick={() => navigate('/settings')}
              title="Settings"
            >
              <i className="fas fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar-container">
          <div className="search-bar">
            <i className="fas fa-search"></i>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages, contacts... (Press /)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-filter-btn"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent' }}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
            <button className="search-filter-btn" title="Advanced Filters">
              <i className="fas fa-sliders-h"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="screen-content with-nav">
        <PullToRefresh onRefresh={handleRefresh} isRefreshing={isLoading}>
          {/* Filters */}
          <div className="chat-filters">
            {FILTERS.map((filter) => {
              const count = getFilterCount(filter.key);
              return (
                <div
                  key={filter.key}
                  className={`filter-chip ${activeFilter === filter.key ? 'active' : ''}`}
                  onClick={() => handleFilterChange(filter.key)}
                >
                  {filter.label}
                  {count > 0 && <span className="count">{count}</span>}
                </div>
              );
            })}
          </div>

          {/* Chat List */}
          <div className="chat-list" ref={chatListRef}>
            {/* Pinned Section */}
            {pinnedChats.length > 0 && (
              <>
                <div className="chat-section-header">
                  <span className="chat-section-title">📌 Pinned</span>
                </div>
                {pinnedChats.map((chat, index) => (
                  <ChatItem
                    key={chat.phone}
                    chat={chat}
                    isSelected={selectedIndex === index}
                    onClick={() => handleChatClick(chat.phone)}
                  />
                ))}
              </>
            )}

            {/* Recent Section */}
            {regularChats.length > 0 && (
              <>
                <div className="chat-section-header">
                  <span className="chat-section-title">Recent</span>
                  {unreadTotal > 0 && (
                    <span className="chat-section-action" onClick={handleMarkAllRead}>
                      Mark all read
                    </span>
                  )}
                </div>
                {regularChats.map((chat, index) => (
                  <ChatItem
                    key={chat.phone}
                    chat={chat}
                    isSelected={selectedIndex === pinnedChats.length + index}
                    onClick={() => handleChatClick(chat.phone)}
                  />
                ))}
              </>
            )}

            {/* Empty State */}
            {filteredChats.length === 0 && !isLoading && (
              <div className="empty-state">
                <i className="fas fa-comments"></i>
                <p>
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : activeFilter !== 'all'
                    ? `No ${activeFilter} chats`
                    : 'No conversations yet'}
                </p>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && chats.length === 0 && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <ChatItemSkeleton key={i} />
                ))}
              </>
            )}
          </div>
        </PullToRefresh>
      </div>

      {/* FAB - New Chat */}
      <button className="fab" onClick={() => navigate('/customers?action=new-chat')}>
        <i className="fas fa-comment-medical"></i>
      </button>
    </div>
  );
}

// Chat Item Skeleton for Loading
function ChatItemSkeleton() {
  return (
    <div className="chat-item">
      <div className="chat-avatar">
        <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }}></div>
      </div>
      <div className="chat-content">
        <div className="chat-row">
          <div className="skeleton" style={{ width: '40%', height: 16 }}></div>
          <div className="skeleton" style={{ width: '20%', height: 12 }}></div>
        </div>
        <div className="skeleton" style={{ width: '80%', height: 14, marginTop: 8 }}></div>
      </div>
    </div>
  );
}

export default Chats;
