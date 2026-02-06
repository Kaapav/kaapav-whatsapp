/**
 * ═══════════════════════════════════════════════════════════════
 * CHAT WINDOW - Full WhatsApp-style Chat Interface
 * Messages, Products, Orders, Quick Replies, AI Suggestions
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useTemplateStore, useUIStore, useSettingsStore } from '../store';
import { chatAPI, messageAPI } from '../api';
import { formatTime, formatDate, getInitials, groupMessagesByDate } from '../utils/helpers';
import ChatBubble from '../components/ChatBubble';
import QuickReplies from '../components/QuickReplies';
import CustomerPanel from '../components/CustomerPanel';
import MediaPicker from '../components/MediaPicker';
import ProductPicker from '../components/ProductPicker';

function ChatWindow() {
  const navigate = useNavigate();
  const { phone } = useParams();

  // Store
  const {
    getChatByPhone,
    getMessages,
    setMessages,
    addMessage,
    updateMessageStatus,
    markAsRead,
    setTyping,
    typingStatus,
    onlineStatus,
  } = useChatStore();
  const { quickReplies, incrementQuickReplyUse } = useTemplateStore();
  const { showToast } = useUIStore();
  const { aiAutoReply, sendReadReceipts } = useSettingsStore();

  // Local state
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // Refs
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  // Get chat and messages from store
  const chat = getChatByPhone(phone);
  const messages = getMessages(phone);
  const isTyping = typingStatus[phone];
  const onlineState = onlineStatus[phone] || 'offline';

  // Fetch messages and customer info
  const fetchData = useCallback(async () => {
    if (!phone) return;

    setIsLoading(true);
    try {
      const [messagesRes, customerRes] = await Promise.all([
        messageAPI.getMessages(phone, { limit: 100 }),
        chatAPI.getCustomer(phone),
      ]);

      if (messagesRes?.messages) {
        setMessages(phone, messagesRes.messages);
      }

      if (customerRes?.customer) {
        setCustomer(customerRes.customer);
      }

      // Mark chat as read
      if (chat?.unread_count > 0) {
        markAsRead(phone);
        if (sendReadReceipts) {
          chatAPI.markRead(phone);
        }
      }

      // Generate AI suggestions based on last message
      if (aiAutoReply && messagesRes?.messages?.length > 0) {
        generateAiSuggestions(messagesRes.messages);
      }
    } catch (err) {
      console.error('Failed to fetch chat data:', err);
      showToast('Failed to load messages', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to go back
      if (e.key === 'Escape') {
        if (isPanelOpen) {
          setIsPanelOpen(false);
        } else {
          navigate('/chats');
        }
        return;
      }

      // Cmd/Ctrl + Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
        return;
      }

      // Cmd/Ctrl + I to open customer info
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setIsPanelOpen(!isPanelOpen);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, messageText]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Generate AI suggestions
  const generateAiSuggestions = (msgs) => {
    const lastMessage = msgs.filter((m) => m.direction === 'in').pop();
    if (!lastMessage) return;

    const text = lastMessage.text?.toLowerCase() || '';

    // Simple keyword-based suggestions (in production, use AI)
    const suggestions = [];

    if (text.includes('price') || text.includes('cost')) {
      suggestions.push('Share price list 💰');
    }
    if (text.includes('order') || text.includes('track')) {
      suggestions.push('Share tracking link 📦');
    }
    if (text.includes('cod') || text.includes('cash')) {
      suggestions.push('Explain COD policy 💵');
    }
    if (text.includes('return') || text.includes('refund')) {
      suggestions.push('Share return policy ↩️');
    }
    if (text.includes('thank') || text.includes('received')) {
      suggestions.push('Ask for review ⭐');
    }
    if (text.includes('catalog') || text.includes('collection')) {
      suggestions.push('Send catalog 📋');
    }

    // Default suggestions
    if (suggestions.length === 0) {
      suggestions.push('Send greeting 👋', 'Share offers 🎁', 'Send catalog 📋');
    }

    setAiSuggestions(suggestions.slice(0, 4));
  };

  // Send message
  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || isSending) return;

    // Optimistic update
    const tempMessage = {
      id: `temp_${Date.now()}`,
      message_id: `temp_${Date.now()}`,
      phone,
      text,
      message_type: 'text',
      direction: 'out',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };

    addMessage(phone, tempMessage);
    setMessageText('');
    setIsSending(true);

    try {
      const response = await messageAPI.sendText(phone, text);

      if (response.success) {
        // Update message with real ID
        updateMessageStatus(phone, tempMessage.message_id, 'sent');
      } else {
        throw new Error(response.error || 'Failed to send');
      }
    } catch (err) {
      console.error('Send message error:', err);
      updateMessageStatus(phone, tempMessage.message_id, 'failed');
      showToast('Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Handle quick reply selection
  const handleQuickReply = (reply) => {
    if (typeof reply === 'string') {
      setMessageText(reply);
    } else if (reply.message) {
      setMessageText(reply.message);
      incrementQuickReplyUse(reply.shortcut);
    }
    textareaRef.current?.focus();
  };

  // Handle AI suggestion
  const handleAiSuggestion = async (suggestion) => {
    // Map suggestions to actual actions
    if (suggestion.includes('tracking')) {
      // Send tracking link
      showToast('Fetching tracking info...', 'default');
    } else if (suggestion.includes('catalog')) {
      setShowProductPicker(true);
    } else if (suggestion.includes('review')) {
      setMessageText("Thank you for shopping with KAAPAV! 🙏 We'd love to hear your feedback. Please share your experience!");
    } else {
      setMessageText(suggestion.replace(/[^\w\s]/gi, '').trim());
    }
    textareaRef.current?.focus();
  };

  // Send product
  const handleSendProduct = async (product) => {
    setShowProductPicker(false);
    setIsSending(true);

    try {
      const response = await messageAPI.sendProduct(phone, product.sku);
      if (response.success) {
        showToast('Product sent!', 'success');
        fetchData(); // Refresh messages
      }
    } catch (err) {
      showToast('Failed to send product', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Send media
  const handleSendMedia = async (media) => {
    setShowMediaPicker(false);
    setIsSending(true);

    try {
      let response;
      if (media.type === 'image') {
        response = await messageAPI.sendImage(phone, media.url, media.caption);
      } else {
        response = await messageAPI.sendDocument(phone, media.url, media.filename, media.caption);
      }

      if (response.success) {
        showToast('Media sent!', 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to send media', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Handle textarea auto-resize
  const handleTextareaChange = (e) => {
    setMessageText(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    return groupMessagesByDate(messages);
  }, [messages]);

  // Filter quick replies for chat context
  const contextualQuickReplies = useMemo(() => {
    const replies = quickReplies?.slice(0, 10) || [];
    return replies.map((r) => r.title || r.shortcut);
  }, [quickReplies]);

  return (
    <div className="screen">
      <div className="chat-window">
        {/* Header */}
        <div className="chat-window-header">
          <button className="back-btn" onClick={() => navigate('/chats')}>
            <i className="fas fa-arrow-left"></i>
          </button>

          <div className="chat-window-user" onClick={() => setIsPanelOpen(true)}>
            <div className="chat-window-avatar">
              {customer?.avatar ? (
                <img src={customer.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                getInitials(chat?.customer_name || customer?.name)
              )}
            </div>
            <div className="chat-window-info">
              <div className="chat-window-name">
                {chat?.customer_name || customer?.name || phone}
                {customer?.tier === 'vip' && (
                  <i className="fas fa-crown" style={{ fontSize: 10, color: '#FFD700', marginLeft: 4 }}></i>
                )}
              </div>
              <div className="chat-window-status">
                {isTyping ? (
                  <>
                    <span className="typing-indicator">typing</span>
                    <span className="typing-dots"><span></span><span></span><span></span></span>
                  </>
                ) : (
                  <>
                    <span className={`status-dot ${onlineState}`}></span>
                    {onlineState === 'online' 
                      ? 'Online' 
                      : customer?.last_seen 
                        ? `Last seen ${formatTime(customer.last_seen)}`
                        : phone
                    }
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="chat-window-actions">
            <button className="header-btn header-btn-glass" title="Call">
              <i className="fas fa-phone"></i>
            </button>
            <button className="header-btn header-btn-glass" title="Video">
              <i className="fas fa-video"></i>
            </button>
            <button
              className="header-btn header-btn-glass"
              onClick={() => setIsPanelOpen(true)}
              title="Customer Info"
            >
              <i className="fas fa-info-circle"></i>
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="messages-container" ref={containerRef}>
          {isLoading && messages.length === 0 ? (
            <div className="loading-messages">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <>
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <React.Fragment key={date}>
                  <div className="message-date-divider">
                    <span className="message-date">{formatDate(date)}</span>
                  </div>
                  {msgs.map((message) => (
                    <ChatBubble key={message.id || message.message_id} message={message} />
                  ))}
                </React.Fragment>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="message received">
                  <div className="message-bubble typing-bubble">
                    <div className="typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* AI Suggestions */}
        {aiSuggestions.length > 0 && (
          <div className="ai-suggestions">
            <div className="ai-header">
              <div className="ai-icon"><i className="fas fa-magic"></i></div>
              <span className="ai-label">AI Suggested Replies</span>
            </div>
            <div className="ai-suggestions-list">
              {aiSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="ai-suggestion"
                  onClick={() => handleAiSuggestion(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Replies */}
        <QuickReplies
          replies={contextualQuickReplies}
          onSelect={handleQuickReply}
        />

        {/* Input Container */}
        <div className="chat-input-container">
          <div className="input-actions">
            <button
              className="input-action-btn"
              onClick={() => setShowMediaPicker(true)}
              title="Attach"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>

          <div className="input-wrapper">
            <div className="message-input-box">
              <textarea
                ref={textareaRef}
                className="message-input"
                placeholder="Type a message..."
                rows="1"
                value={messageText}
                onChange={handleTextareaChange}
                onKeyPress={handleKeyPress}
                disabled={isSending}
              />
              <i 
                className="far fa-smile emoji-btn"
                onClick={() => {/* Open emoji picker */}}
              ></i>
            </div>
          </div>

          <button
            className="input-action-btn"
            onClick={() => setShowProductPicker(true)}
            title="Send Product"
          >
            <i className="fas fa-box"></i>
          </button>

          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!messageText.trim() || isSending}
          >
            <i className={`fas ${isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          </button>
        </div>

        {/* Customer Panel (Slide-in) */}
        <div
          className={`panel-overlay ${isPanelOpen ? 'show' : ''}`}
          onClick={() => setIsPanelOpen(false)}
        />
        <CustomerPanel
          customer={customer}
          chat={chat}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          onRefresh={fetchData}
        />

        {/* Media Picker Modal */}
        {showMediaPicker && (
          <MediaPicker
            onSelect={handleSendMedia}
            onClose={() => setShowMediaPicker(false)}
          />
        )}

        {/* Product Picker Modal */}
        {showProductPicker && (
          <ProductPicker
            onSelect={handleSendProduct}
            onClose={() => setShowProductPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

export default ChatWindow;
