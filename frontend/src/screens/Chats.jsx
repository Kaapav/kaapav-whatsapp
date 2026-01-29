/**
 * ════════════════════════════════════════════════════════════════
 * CHATS SCREEN
 * Chat list with filters and search
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, FiFilter, FiStar, FiMessageCircle,
  FiUser, FiCheck, FiCheckCheck, FiClock
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { useChatStore } from '../store';
import PullToRefresh from '../components/PullToRefresh';

// ═══════════════════════════════════════════════════════════════
// FILTER TABS
// ═══════════════════════════════════════════════════════════════

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'starred', label: 'Starred' },
  { id: 'pending', label: 'Pending' },
];

// ═══════════════════════════════════════════════════════════════
// CHAT ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════

function ChatItem({ chat, onClick }) {
  const getMessageIcon = () => {
    if (chat.lastDirection === 'incoming') return null;
    
    switch (chat.status) {
      case 'read': return <FiCheckCheck className="text-success" size={14} />;
      case 'delivered': return <FiCheckCheck className="text-gray-400" size={14} />;
      case 'sent': return <FiCheck className="text-gray-400" size={14} />;
      default: return <FiClock className="text-gray-500" size={14} />;
    }
  };
  
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const tierColors = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-400 to-cyan-600',
    diamond: 'from-purple-400 to-pink-500',
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-3 p-4 border-b border-dark-200 cursor-pointer hover:bg-dark-100 transition-colors"
    >
      {/* Avatar */}
      <div className="relative">
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${tierColors[chat.tier] || 'from-dark-300 to-dark-400'} flex items-center justify-center text-white font-semibold text-lg`}>
          {getInitials(chat.name)}
        </div>
        {chat.isStarred && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <FiStar size={12} className="text-black fill-current" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-white truncate">
            {chat.name || chat.phone}
          </h3>
          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
            {chat.lastTimestamp && formatDistanceToNow(new Date(chat.lastTimestamp), { addSuffix: false })}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {getMessageIcon()}
          <p className="text-sm text-gray-400 truncate flex-1">
            {chat.lastMessage || 'No messages'}
          </p>
        </div>
        
        {/* Labels */}
        {chat.labels?.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {chat.labels.slice(0, 2).map((label, i) => (
              <span key={i} className="px-2 py-0.5 bg-dark-300 rounded-full text-xs text-gray-300">
                {label}
              </span>
            ))}
            {chat.labels.length > 2 && (
              <span className="text-xs text-gray-500">+{chat.labels.length - 2}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Unread badge */}
      {chat.unreadCount > 0 && (
        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <span className="text-xs font-semibold text-black">
            {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CHATS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Chats() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { chats, unreadCount, isLoading, fetchChats } = useChatStore();
  
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const loadChats = useCallback(async () => {
    const params = {};
    
    if (search) params.search = search;
    if (activeFilter === 'unread') params.unread = true;
    if (activeFilter === 'starred') params.starred = true;
    if (activeFilter === 'pending') params.status = 'pending';
    
    await fetchChats(params);
  }, [search, activeFilter, fetchChats]);
  
  useEffect(() => {
    loadChats();
  }, [loadChats]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadChats();
    setIsRefreshing(false);
  };
  
  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    setSearchParams(filterId !== 'all' ? { filter: filterId } : {});
  };
  
  const filteredChats = chats.filter(chat => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        chat.name?.toLowerCase().includes(searchLower) ||
        chat.phone?.includes(search) ||
        chat.lastMessage?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });
  
  return (
    <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <div className="min-h-screen bg-dark safe-top">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Chats</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-primary">{unreadCount} unread</p>
                )}
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="input pl-11 bg-dark-100"
              />
            </div>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto hide-scrollbar">
            {FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-primary text-black'
                    : 'bg-dark-200 text-gray-400 hover:bg-dark-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chat List */}
        <div className="pb-20">
          {isLoading && !chats.length ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-14 h-14 skeleton rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 skeleton rounded w-1/3" />
                    <div className="h-3 skeleton rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length > 0 ? (
            <AnimatePresence>
              {filteredChats.map(chat => (
                <ChatItem
                  key={chat.phone}
                  chat={chat}
                  onClick={() => navigate(`/chats/${chat.phone}`)}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <FiMessageCircle size={48} className="mb-4 opacity-50" />
              <p className="text-lg">No chats found</p>
              <p className="text-sm">
                {search ? 'Try a different search' : 'Start a conversation'}
              </p>
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}