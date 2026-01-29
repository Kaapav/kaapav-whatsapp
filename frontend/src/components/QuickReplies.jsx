/**
 * ════════════════════════════════════════════════════════════════
 * QUICK REPLIES
 * Quick reply panel for chat
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSearch, FiMessageCircle, FiZap } from 'react-icons/fi';
import api from '../api';

// ═══════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'all', label: 'All', icon: FiZap },
  { id: 'greeting', label: 'Greeting', icon: FiMessageCircle },
  { id: 'sales', label: 'Sales', icon: FiMessageCircle },
  { id: 'support', label: 'Support', icon: FiMessageCircle },
  { id: 'closing', label: 'Closing', icon: FiMessageCircle },
];

// ═══════════════════════════════════════════════════════════════
// QUICK REPLY ITEM
// ═══════════════════════════════════════════════════════════════

function QuickReplyItem({ reply, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(reply)}
      className="w-full text-left p-4 bg-dark-200 rounded-xl hover:bg-dark-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-white">{reply.title}</span>
        <span className="text-xs text-gray-500 bg-dark-300 px-2 py-0.5 rounded">
          /{reply.shortcut}
        </span>
      </div>
      <p className="text-sm text-gray-400 line-clamp-2">{reply.message}</p>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function QuickReplies({ onSelect, onClose }) {
  const [replies, setReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  
  useEffect(() => {
    const loadReplies = async () => {
      try {
        const data = await api.messages.getQuickReplies();
        setReplies(data.quickReplies || []);
      } catch (error) {
        console.error('Failed to load quick replies:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadReplies();
  }, []);
  
  // Filter replies
  const filteredReplies = replies.filter(reply => {
    const matchesSearch = !search || 
      reply.title.toLowerCase().includes(search.toLowerCase()) ||
      reply.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      reply.message.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || reply.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 bg-dark-100 rounded-t-3xl max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-100 border-b border-dark-200 p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Quick Replies</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-200 rounded-full transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search replies..."
              className="input pl-10 py-2.5 bg-dark-200"
            />
          </div>
          
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-primary text-black'
                    : 'bg-dark-200 text-gray-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* List */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)] space-y-2">
          {isLoading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))
          ) : filteredReplies.length > 0 ? (
            filteredReplies.map(reply => (
              <QuickReplyItem
                key={reply.id}
                reply={reply}
                onClick={onSelect}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FiMessageCircle size={40} className="mx-auto mb-3 opacity-50" />
              <p>No quick replies found</p>
            </div>
          )}
        </div>
        
        {/* Tip */}
        <div className="p-4 border-t border-dark-200 bg-dark-100">
          <p className="text-xs text-gray-500 text-center">
            💡 Tip: Type / followed by shortcut to use quick replies in chat
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}