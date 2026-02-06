/**
 * ═══════════════════════════════════════════════════════════════
 * CHAT BUBBLE - Message Display Component
 * Text, Media, Products, Orders
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { formatTime, formatCurrency } from '../utils/helpers';

function ChatBubble({ message }) {
  if (!message) return null;

  const {
    text,
    message_type,
    direction,
    status,
    timestamp,
    media_url,
    media_caption,
    product,
    order,
    buttons,
  } = message;

  const isOutgoing = direction === 'out' || direction === 'outgoing';

  const renderStatus = () => {
    if (!isOutgoing) return null;

    switch (status) {
      case 'sending':
        return <i className="fas fa-clock message-status sending"></i>;
      case 'sent':
        return <i className="fas fa-check message-status sent"></i>;
      case 'delivered':
        return <i className="fas fa-check-double message-status delivered"></i>;
      case 'read':
        return <i className="fas fa-check-double message-status read"></i>;
      case 'failed':
        return <i className="fas fa-exclamation-circle message-status" style={{ color: 'var(--danger)' }}></i>;
      default:
        return <i className="fas fa-check message-status sent"></i>;
    }
  };

  // Product Message
  if (message_type === 'product' && product) {
    return (
      <div className={`message ${isOutgoing ? 'sent' : 'received'}`}>
        <div className="message-product">
          {product.image_url && (
            <img src={product.image_url} className="product-img" alt="" />
          )}
          <div className="product-info">
            <div className="product-name">{product.name || ''}</div>
            <div className="product-price-row">
              <span className="product-price">
                {product.price ? formatCurrency(product.price) : ''}
              </span>
              {product.compare_price && (
                <span className="product-old-price">
                  {formatCurrency(product.compare_price)}
                </span>
              )}
            </div>
            <div className="product-actions">
              <button className="product-btn product-btn-secondary">
                <i className="fas fa-eye"></i> View
              </button>
              <button className="product-btn product-btn-primary">
                <i className="fas fa-cart-plus"></i> Add
              </button>
            </div>
          </div>
        </div>
        <div className="message-footer" style={{ marginTop: 6 }}>
          <span className="message-time" style={{ color: 'var(--gray)' }}>
            {formatTime(timestamp)}
          </span>
          {renderStatus()}
        </div>
      </div>
    );
  }

  // Order Message
  if (message_type === 'order' && order) {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    
    return (
      <div className={`message ${isOutgoing ? 'sent' : 'received'}`}>
        <div className="message-order">
          <div className="order-header">
            <span className="order-id">{order.order_id || ''}</span>
            <span className={`order-status status-${order.status?.toLowerCase()}`}>
              {order.status || ''}
            </span>
          </div>
          {items?.length > 0 && (
            <div className="order-items">
              {items.slice(0, 4).map((item, idx) => (
                <img
                  key={idx}
                  src={item.image_url || item.image}
                  className="order-item-img"
                  alt=""
                />
              ))}
            </div>
          )}
          <div className="order-total">
            <span className="order-total-label">
              Total {order.payment_method ? `(${order.payment_method})` : ''}
            </span>
            <span className="order-total-value">
              {order.total ? formatCurrency(order.total) : ''}
            </span>
          </div>
        </div>
        <div className="message-footer" style={{ marginTop: 6 }}>
          <span className="message-time" style={{ color: 'var(--gray)' }}>
            {formatTime(timestamp)}
          </span>
          {renderStatus()}
        </div>
      </div>
    );
  }

  // Image Message
  if (message_type === 'image' && media_url) {
    return (
      <div className={`message ${isOutgoing ? 'sent' : 'received'}`}>
        <div className="message-bubble" style={{ padding: 4 }}>
          <img
            src={media_url}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: 300,
              borderRadius: 'var(--radius)',
              display: 'block',
            }}
          />
          {media_caption && (
            <div style={{ padding: '8px 8px 4px', fontSize: 14 }}>
              {media_caption}
            </div>
          )}
          <div className="message-footer" style={{ padding: '4px 8px' }}>
            <span className="message-time">{formatTime(timestamp)}</span>
            {renderStatus()}
          </div>
        </div>
      </div>
    );
  }

  // Document Message
  if (message_type === 'document' && media_url) {
    return (
      <div className={`message ${isOutgoing ? 'sent' : 'received'}`}>
        <div className="message-bubble">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 0',
          }}>
            <i className="fas fa-file-pdf" style={{ fontSize: 32, color: 'var(--danger)' }}></i>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {message.filename || 'Document'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)' }}>
                PDF
              </div>
            </div>
            <a
              href={media_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold-dark)',
              }}
            >
              <i className="fas fa-download"></i>
            </a>
          </div>
          <div className="message-footer">
            <span className="message-time">{formatTime(timestamp)}</span>
            {renderStatus()}
          </div>
        </div>
      </div>
    );
  }

  // Interactive Buttons Message
  if (message_type === 'buttons' && buttons) {
    const parsedButtons = typeof buttons === 'string' ? JSON.parse(buttons) : buttons;
    
    return (
      <div className={`message ${isOutgoing ? 'sent' : 'received'}`}>
        <div className="message-bubble">
          <div className="message-text">{text || ''}</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {parsedButtons.map((btn, idx) => (
              <button
                key={idx}
                style={{
                  padding: '10px 16px',
                  background: 'var(--cream)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--gold-dark)',
                  cursor: 'default',
                }}
              >
                {btn.title || btn.text}
              </button>
            ))}
          </div>
          <div className="message-footer">
            <span className="message-time">{formatTime(timestamp)}</span>
            {renderStatus()}
          </div>
        </div>
      </div>
    );
  }

  // Default Text Message
  return (
    <div className={`message ${isOutgoing ? 'sent' : 'received'}`}>
      <div className="message-bubble">
        <div className="message-text">{text || ''}</div>
        <div className="message-footer">
          <span className="message-time">{formatTime(timestamp)}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}

export default ChatBubble;
