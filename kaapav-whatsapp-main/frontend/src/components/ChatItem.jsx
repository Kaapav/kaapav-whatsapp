/**
 * ═══════════════════════════════════════════════════════════════
 * CHAT ITEM - Individual Chat List Item
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { formatRelativeTime, getInitials } from '../utils/helpers';

function ChatItem({ chat, isSelected, onClick }) {
  if (!chat) return null;

  const {
    phone,
    customer_name,
    avatar,
    last_message,
    last_message_type,
    last_timestamp,
    last_direction,
    unread_count,
    is_starred,
    is_blocked,
    labels,
    status,
    segment,
    is_typing,
  } = chat;

  const getOnlineStatus = () => {
    if (chat.is_online) return 'online';
    if (chat.is_away) return 'away';
    return 'offline';
  };

  const getLabelClass = (label) => {
    const classes = {
      order: 'label-order',
      vip: 'label-vip',
      new: 'label-new',
      support: 'label-support',
      urgent: 'label-urgent',
    };
    return classes[label?.toLowerCase()] || 'label-order';
  };

  const getPreviewIcon = () => {
    if (last_direction === 'out') {
      if (chat.last_status === 'read') {
        return <i className="fas fa-check-double chat-preview-icon" style={{ color: '#4FC3F7' }}></i>;
      }
      if (chat.last_status === 'delivered') {
        return <i className="fas fa-check-double chat-preview-icon"></i>;
      }
      return <i className="fas fa-check chat-preview-icon"></i>;
    }

    if (last_message_type === 'image') {
      return <i className="fas fa-image chat-preview-icon"></i>;
    }
    if (last_message_type === 'document') {
      return <i className="fas fa-file chat-preview-icon"></i>;
    }
    if (last_message_type === 'audio') {
      return <i className="fas fa-microphone chat-preview-icon"></i>;
    }
    if (last_message_type === 'video') {
      return <i className="fas fa-video chat-preview-icon"></i>;
    }

    return null;
  };

  const parsedLabels = typeof labels === 'string' ? JSON.parse(labels || '[]') : labels || [];

  return (
    <div
      className={`chat-item ${unread_count > 0 ? 'unread' : ''} ${is_starred ? 'pinned' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="chat-avatar">
        <div className="avatar avatar-gold">
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            getInitials(customer_name || phone)
          )}
        </div>
        <span className={`avatar-status ${getOnlineStatus()}`}></span>
      </div>

      <div className="chat-content">
        <div className="chat-row">
          <div className="chat-name-wrapper">
            <span className="chat-name">{customer_name || phone}</span>
            {segment === 'vip' && (
              <i className="fas fa-crown chat-verified" style={{ color: '#FFD700' }}></i>
            )}
          </div>

          <div className="chat-labels">
            {parsedLabels.slice(0, 2).map((label, idx) => (
              <span key={idx} className={`chat-label ${getLabelClass(label)}`}>
                {label}
              </span>
            ))}
          </div>

          <span className="chat-time">
            {last_timestamp ? formatRelativeTime(last_timestamp) : ''}
          </span>
        </div>

        <div className="chat-preview-row">
          <div className={`chat-preview ${is_typing ? 'chat-typing' : ''}`}>
            {is_typing ? (
              <>
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
                typing...
              </>
            ) : (
              <>
                {getPreviewIcon()}
                <span className="chat-preview-text">
                  {last_message || ''}
                </span>
              </>
            )}
          </div>

          <div className="chat-meta">
            {unread_count > 0 && (
              <span className="unread-badge">
                {unread_count > 99 ? '99+' : unread_count}
              </span>
            )}
            {is_starred && <i className="fas fa-thumbtack chat-pin"></i>}
            {is_blocked && <i className="fas fa-ban chat-muted" style={{ color: 'var(--danger)' }}></i>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatItem;
