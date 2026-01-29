/**
 * ════════════════════════════════════════════════════════════════
 * CHAT WINDOW SCREEN
 * Real-time messaging interface
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, FiMoreVertical, FiSend, FiImage, FiPaperclip,
  FiSmile, FiMic, FiX, FiPhone, FiShoppingBag, FiUser,
  FiStar, FiBot, FiTag, FiCopy
} from 'react-icons/fi';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import { useChatStore, useUIStore } from '../store';
import api from '../api';
import ChatBubble from '../components/ChatBubble';
import QuickReplies from '../components/QuickReplies';
import MediaPicker from '../components/MediaPicker';

// ═══════════════════════════════════════════════════════════════
// DATE DIVIDER
// ═══════════════════════════════════════════════════════════════

function DateDivider({ date }) {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d, yyyy');
  };
  
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 bg-dark-200 rounded-full text-xs text-gray-400">
        {formatDate(date)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHAT HEADER
// ═══════════════════════════════════════════════════════════════

function ChatHeader({ chat, onBack, onToggleStar, onToggleBot, onShowInfo }) {
  const [showMenu, setShowMenu] = useState(false);
  
  const tierColors = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-400 to-cyan-600',
    diamond: 'from-purple-400 to-pink-500',
  };
  
  return (
    <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200 safe-top">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-dark-200 rounded-full">
          <FiArrowLeft size={24} />
        </button>
        
        <div 
          className="flex-1 flex items-center gap-3 cursor-pointer"
          onClick={onShowInfo}
        >
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${tierColors[chat?.customer?.tier] || 'from-dark-300 to-dark-400'} flex items-center justify-center text-white font-semibold`}>
            {chat?.name?.[0]?.toUpperCase() || '?'}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white truncate">
                {chat?.name || chat?.phone}
              </h2>
              {chat?.isStarred && (
                <FiStar size={14} className="text-primary fill-current" />
              )}
            </div>
            <p className="text-xs text-gray-400">
              {chat?.isBotEnabled ? '🤖 Bot Active' : '👤 Manual Mode'} 
              {chat?.customer?.segment && ` • ${chat.customer.segment}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => window.open(`tel:${chat?.phone}`)}
            className="p-2 hover:bg-dark-200 rounded-full"
          >
            <FiPhone size={20} className="text-gray-400" />
          </button>
          
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-dark-200 rounded-full relative"
          >
            <FiMoreVertical size={20} className="text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setShowMenu(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute right-4 top-full mt-1 w-48 bg-dark-100 border border-dark-200 rounded-xl shadow-xl z-40 overflow-hidden"
            >
              <button
                onClick={() => { onToggleStar(); setShowMenu(false); }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-dark-200"
              >
                <FiStar size={18} className={chat?.isStarred ? 'text-primary fill-current' : 'text-gray-400'} />
                <span>{chat?.isStarred ? 'Unstar' : 'Star'}</span>
              </button>
              <button
                onClick={() => { onToggleBot(); setShowMenu(false); }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-dark-200"
              >
                <FiBot size={18} className={chat?.isBotEnabled ? 'text-success' : 'text-gray-400'} />
                <span>{chat?.isBotEnabled ? 'Disable Bot' : 'Enable Bot'}</span>
              </button>
              <button
                onClick={() => { 
                  navigator.clipboard.writeText(chat?.phone);
                  toast.success('Phone copied!');
                  setShowMenu(false);
                }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-dark-200"
              >
                <FiCopy size={18} className="text-gray-400" />
                <span>Copy Phone</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE INPUT
// ═══════════════════════════════════════════════════════════════

function MessageInput({ onSend, onShowQuickReplies, onShowMedia, disabled }) {
  const [message, setMessage] = useState('');
  
  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="sticky bottom-0 bg-dark border-t border-dark-200 p-3 safe-bottom">
      <div className="flex items-end gap-2">
        {/* Attachments */}
        <div className="flex gap-1">
          <button 
            onClick={onShowMedia}
            className="p-2.5 rounded-full bg-dark-200 hover:bg-dark-300"
          >
            <FiImage size={20} className="text-gray-400" />
          </button>
          <button 
            onClick={onShowQuickReplies}
            className="p-2.5 rounded-full bg-dark-200 hover:bg-dark-300"
          >
            <FiSmile size={20} className="text-gray-400" />
          </button>
        </div>
        
        {/* Input */}
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 bg-dark-200 border border-dark-300 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none max-h-32"
            style={{ minHeight: '48px' }}
          />
        </div>
        
        {/* Send Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={`p-3 rounded-full transition-colors ${
            message.trim() 
              ? 'bg-primary text-black' 
              : 'bg-dark-200 text-gray-500'
          }`}
        >
          <FiSend size={20} />
        </motion.button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CHAT WINDOW
// ═══════════════════════════════════════════════════════════════

export default function ChatWindow() {
  const { phone } = useParams();
  const navigate = useNavigate();
  
  const { 
    currentChat, messages, hasMore, isLoading,
    fetchChat, fetchMessages, addMessage, markAsRead, clearMessages, clearCurrentChat
  } = useChatStore();
  
  const { showQuickReplies, showMediaPicker, setShowQuickReplies, setShowMediaPicker } = useUIStore();
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isSending, setIsSending] = useState(false);
  
  // Load chat and messages
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchChat(phone);
        await fetchMessages(phone);
        markAsRead(phone);
      } catch (error) {
        toast.error('Failed to load chat');
        navigate('/chats');
      }
    };
    
    loadData();
    
    // Polling for new messages
    const interval = setInterval(() => {
      fetchMessages(phone);
    }, 5000);
    
    return () => {
      clearInterval(interval);
      clearMessages();
      clearCurrentChat();
    };
  }, [phone]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Send message
  const handleSendMessage = async (text) => {
    if (!text || isSending) return;
    
    setIsSending(true);
    
    // Optimistic update
    const tempMessage = {
      id: Date.now(),
      text,
      direction: 'outgoing',
      type: 'text',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    addMessage(tempMessage);
    
    try {
      const result = await api.messages.send(phone, 'text', { text });
      
      // Update message status
      if (result.success) {
        // Message sent successfully
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };
  
  // Send quick reply
  const handleQuickReply = (reply) => {
    handleSendMessage(reply.message);
    setShowQuickReplies(false);
  };
  
  // Toggle star
  const handleToggleStar = async () => {
    try {
      await api.chats.update(phone, { is_starred: !currentChat?.isStarred });
      await fetchChat(phone);
      toast.success(currentChat?.isStarred ? 'Unstarred' : 'Starred');
    } catch (error) {
      toast.error('Failed to update');
    }
  };
  
  // Toggle bot
  const handleToggleBot = async () => {
    try {
      await api.chats.toggleBot(phone);
      await fetchChat(phone);
      toast.success(currentChat?.isBotEnabled ? 'Bot disabled' : 'Bot enabled');
    } catch (error) {
      toast.error('Failed to update');
    }
  };
  
  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.timestamp), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});
  
  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* Header */}
      <ChatHeader
        chat={currentChat}
        onBack={() => navigate('/chats')}
        onToggleStar={handleToggleStar}
        onToggleBot={handleToggleBot}
        onShowInfo={() => navigate(`/customers/${phone}`)}
      />
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2"
      >
        {isLoading && messages.length === 0 ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
                <div className={`h-16 skeleton rounded-2xl ${i % 2 === 0 ? 'w-2/3 rounded-br-md' : 'w-3/4 rounded-bl-md'}`} />
              </div>
            ))}
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <DateDivider date={date} />
              {msgs.map((message, index) => (
                <ChatBubble 
                  key={message.id || index} 
                  message={message} 
                />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <MessageInput
        onSend={handleSendMessage}
        onShowQuickReplies={() => setShowQuickReplies(true)}
        onShowMedia={() => setShowMediaPicker(true)}
        disabled={isSending}
      />
      
      {/* Quick Replies Panel */}
      <AnimatePresence>
        {showQuickReplies && (
          <QuickReplies
            onSelect={handleQuickReply}
            onClose={() => setShowQuickReplies(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Media Picker Panel */}
      <AnimatePresence>
        {showMediaPicker && (
          <MediaPicker
            onSelect={(media) => {
              // Handle media send
              setShowMediaPicker(false);
            }}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}