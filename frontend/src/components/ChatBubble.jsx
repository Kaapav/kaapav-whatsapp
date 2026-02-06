/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV CHAT BUBBLE - LEGENDARY EDITION
 * Gold & White Theme | Production Ready
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, memo } from 'react';
import { formatTime, formatCurrency } from '../utils/helpers';

// ═══════════════════════════════════════════════════════════════
// THEME CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const THEME = {
  // Gold palette
  gold: '#C49432',
  goldLight: '#D4A84B',
  goldDark: '#A67C28',
  goldGradient: 'linear-gradient(135deg, #D4A84B 0%, #C49432 100%)',
  goldShadow: '0 4px 12px rgba(196, 148, 50, 0.3)',
  
  // Neutrals
  white: '#FFFFFF',
  cream: '#FBF8F1',
  dark: '#1A1A1A',
  darkSoft: '#374151',
  gray: '#6B7280',
  grayLight: '#9CA3AF',
  border: '#E5E7EB',
  
  // Shadows
  shadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.12)',
  
  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  purple: '#8B5CF6',
};

// Order status colors
const STATUS_COLORS = {
  pending: { bg: '#FEF3C7', color: '#D97706', icon: '⏳' },
  confirmed: { bg: '#DBEAFE', color: '#2563EB', icon: '✅' },
  processing: { bg: '#EDE9FE', color: '#7C3AED', icon: '⚙️' },
  shipped: { bg: '#CFFAFE', color: '#0891B2', icon: '🚚' },
  delivered: { bg: '#D1FAE5', color: '#059669', icon: '📦' },
  cancelled: { bg: '#FEE2E2', color: '#DC2626', icon: '❌' },
};

// File type icons
const FILE_ICONS = {
  PDF: { icon: 'fa-file-pdf', color: '#DC2626' },
  DOC: { icon: 'fa-file-word', color: '#2563EB' },
  DOCX: { icon: 'fa-file-word', color: '#2563EB' },
  XLS: { icon: 'fa-file-excel', color: '#059669' },
  XLSX: { icon: 'fa-file-excel', color: '#059669' },
  PPT: { icon: 'fa-file-powerpoint', color: '#D97706' },
  PPTX: { icon: 'fa-file-powerpoint', color: '#D97706' },
  ZIP: { icon: 'fa-file-archive', color: '#7C3AED' },
  RAR: { icon: 'fa-file-archive', color: '#7C3AED' },
  DEFAULT: { icon: 'fa-file', color: '#6B7280' },
};

// ═══════════════════════════════════════════════════════════════
// ANIMATION STYLES
// ═══════════════════════════════════════════════════════════════
const animations = `
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// Inject animations
if (typeof document !== 'undefined' && !document.getElementById('chat-bubble-animations')) {
  const style = document.createElement('style');
  style.id = 'chat-bubble-animations';
  style.textContent = animations;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const ChatBubble = memo(function ChatBubble({ message, onButtonClick }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [buttonHover, setButtonHover] = useState(null);

  if (!message) return null;

  // Destructure message properties
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
    button_text,
    button_id,
    is_auto_reply,
    is_menu,
  } = message;

  // Direction detection (handle both formats)
  const isOutgoing = direction === 'outgoing' || direction === 'out';
  const isIncoming = !isOutgoing;

  // ═══════════════════════════════════════════════════════════════
  // PARSE BUTTONS FROM VARIOUS FORMATS
  // ═══════════════════════════════════════════════════════════════
  const parseButtons = () => {
  // If buttons exists
  if (buttons) {
    // Already an array
    if (Array.isArray(buttons)) return buttons;
    
    // String - try to parse as JSON
    if (typeof buttons === 'string') {
      try {
        const parsed = JSON.parse(buttons);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('Button parse failed:', e.message);
      }
    }
  }

  // Fallback: parse from button_text (pipe-separated)
  if (button_text && typeof button_text === 'string') {
    const titles = button_text.split('|').map(t => t.trim()).filter(Boolean);
    if (titles.length > 0) {
      return titles.map((title, idx) => ({
        id: `btn_${idx}`,
        title: title,
        text: title,
      }));
    }
  }

  return null;
};

  // ═══════════════════════════════════════════════════════════════
  // EXTRACT DISPLAY TEXT
  // ═══════════════════════════════════════════════════════════════
  const getDisplayText = () => {
    if (!text) return '';

    // If text is a string
    if (typeof text === 'string') {
      const trimmed = text.trim();

      // Try to parse JSON
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return extractFromParsed(parsed);
        } catch {
          // Remove button markers from text like "[Button1] [Button2]"
          return trimmed.replace(/\[([^\]]+)\]/g, '').trim();
        }
      }

      // Remove button markers
      return trimmed.replace(/\[([^\]]+)\]/g, '').trim();
    }

    // If text is an object
    if (typeof text === 'object') {
      return extractFromParsed(text);
    }

    return String(text);
  };

  const extractFromParsed = (obj) => {
    if (!obj) return '';

    // Interactive messages
    if (obj.interactive) {
      const i = obj.interactive;
      if (i.button_reply?.title) return i.button_reply.title;
      if (i.list_reply?.title) return i.list_reply.title;
      if (i.body?.text) return i.body.text;
      return '📱 Interactive';
    }

    // Text body
    if (obj.text?.body) return obj.text.body;
    if (obj.body?.text) return obj.body.text;
    if (typeof obj.body === 'string') return obj.body;
    if (typeof obj.text === 'string') return obj.text;

    // Media captions
    if (obj.caption) return obj.caption;
    if (obj.image?.caption) return obj.image.caption;

    // Media types
    if (obj.image) return '📷 Photo';
    if (obj.video) return '🎥 Video';
    if (obj.audio) return '🎵 Audio';
    if (obj.voice) return '🎤 Voice';
    if (obj.document) return `📄 ${obj.document.filename || 'Document'}`;
    if (obj.sticker) return '🎭 Sticker';
    if (obj.location) return `📍 ${obj.location.name || 'Location'}`;
    if (obj.contacts) return `👤 ${obj.contacts[0]?.name?.formatted_name || 'Contact'}`;
    if (obj.reaction) return obj.reaction.emoji || '👍';
    if (obj.order) return '🛒 Order';

    return '💬 Message';
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER STATUS INDICATOR
  // ═══════════════════════════════════════════════════════════════
  const renderStatus = () => {
    if (!isOutgoing) return null;

    const configs = {
      sending: { icon: 'fa-clock', color: 'rgba(255,255,255,0.5)' },
      sent: { icon: 'fa-check', color: 'rgba(255,255,255,0.7)' },
      delivered: { icon: 'fa-check-double', color: 'rgba(255,255,255,0.7)' },
      read: { icon: 'fa-check-double', color: '#53BDEB' },
      failed: { icon: 'fa-exclamation-circle', color: '#EF4444' },
    };

    const config = configs[status] || configs.sent;

    return (
      <i
        className={`fas ${config.icon}`}
        style={{ color: config.color, fontSize: 11, marginLeft: 4 }}
      />
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER MESSAGE FOOTER
  // ═══════════════════════════════════════════════════════════════
  const renderFooter = (customColor = null) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 6,
    }}>
      <span style={{
        fontSize: 11,
        color: customColor || (isOutgoing ? 'rgba(255,255,255,0.7)' : THEME.grayLight),
      }}>
        {formatTime(timestamp)}
      </span>
      {renderStatus()}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // CONTAINER WRAPPER
  // ═══════════════════════════════════════════════════════════════
  const MessageContainer = ({ children, customStyle = {} }) => (
    <div style={{
      display: 'flex',
      justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
      marginBottom: 8,
      padding: '0 12px',
      animation: isOutgoing ? 'slideInRight 0.3s ease' : 'slideInLeft 0.3s ease',
      ...customStyle,
    }}>
      {children}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER: BUTTON/MENU MESSAGE (Autoresponder)
  // ═══════════════════════════════════════════════════════════════
  const parsedButtons = parseButtons();
  const hasButtons = parsedButtons && parsedButtons.length > 0;
  const isButtonMessage = hasButtons || message_type === 'buttons' || message_type === 'interactive' && button_text;

  if (isButtonMessage && hasButtons) {
    const displayText = getDisplayText();

    const handleClick = (btn) => {
      if (onButtonClick) {
        onButtonClick({
          phone: message.phone,
          buttonId: btn.id || btn.reply?.id || btn.title,
          buttonTitle: btn.title || btn.text || btn.reply?.title,
          messageId: message.message_id || message.id,
        });
      }
    };

    return (
      <MessageContainer>
        <div style={{
          background: THEME.white,
          borderRadius: 16,
          maxWidth: 320,
          overflow: 'hidden',
          boxShadow: THEME.shadowMd,
          border: `1px solid ${THEME.border}`,
          animation: 'fadeIn 0.3s ease',
        }}>
          {/* Gold accent bar */}
          <div style={{
            height: 4,
            background: THEME.goldGradient,
          }} />

          {/* Message body */}
          {displayText && (
            <div style={{
              padding: '16px 16px 12px',
              fontSize: 15,
              lineHeight: 1.6,
              color: THEME.dark,
              whiteSpace: 'pre-wrap',
            }}>
              {displayText}
            </div>
          )}

          {/* Buttons */}
          <div style={{ borderTop: `1px solid ${THEME.border}` }}>
            {parsedButtons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleClick(btn)}
                onMouseEnter={() => setButtonHover(idx)}
                onMouseLeave={() => setButtonHover(null)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: buttonHover === idx ? THEME.cream : THEME.white,
                  border: 'none',
                  borderTop: idx > 0 ? `1px solid ${THEME.border}` : 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  color: THEME.gold,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                <i className="fas fa-reply" style={{ fontSize: 12, opacity: 0.7 }} />
                {btn.title || btn.text || btn.reply?.title || 'Option'}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 14px',
            background: '#FAFAFA',
            borderTop: `1px solid ${THEME.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 4,
          }}>
            {is_auto_reply && (
              <span style={{
                fontSize: 10,
                color: THEME.grayLight,
                background: THEME.cream,
                padding: '2px 6px',
                borderRadius: 4,
                marginRight: 'auto',
              }}>
                🤖 Auto
              </span>
            )}
            <span style={{ fontSize: 11, color: THEME.grayLight }}>
              {formatTime(timestamp)}
            </span>
          </div>
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: PRODUCT CARD
  // ═══════════════════════════════════════════════════════════════
  if (message_type === 'product' && product) {
    const p = typeof product === 'string' ? JSON.parse(product) : product;

    return (
      <MessageContainer>
        <div style={{
          background: THEME.white,
          borderRadius: 16,
          maxWidth: 280,
          overflow: 'hidden',
          boxShadow: THEME.shadowMd,
          border: `1px solid ${THEME.border}`,
        }}>
          {p.image_url && (
            <div style={{ position: 'relative' }}>
              <img
                src={p.image_url}
                alt={p.name}
                onLoad={() => setImageLoaded(true)}
                style={{
                  width: '100%',
                  height: 160,
                  objectFit: 'cover',
                  opacity: imageLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                }}
              />
              {!imageLoaded && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: THEME.cream,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <i className="fas fa-image" style={{ fontSize: 32, color: THEME.grayLight }} />
                </div>
              )}
            </div>
          )}

          <div style={{ padding: 14 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: THEME.dark,
              marginBottom: 8,
              lineHeight: 1.3,
            }}>
              {p.name || 'Product'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: THEME.gold }}>
                {p.price ? formatCurrency(p.price) : ''}
              </span>
              {p.compare_price && p.compare_price > p.price && (
                <>
                  <span style={{
                    fontSize: 13,
                    color: THEME.grayLight,
                    textDecoration: 'line-through',
                  }}>
                    {formatCurrency(p.compare_price)}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: THEME.success,
                    background: '#D1FAE5',
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}>
                    {Math.round((1 - p.price / p.compare_price) * 100)}% OFF
                  </span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                flex: 1,
                padding: '10px 12px',
                background: THEME.cream,
                border: `1px solid ${THEME.gold}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: THEME.gold,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}>
                <i className="fas fa-eye" /> View
              </button>
              <button style={{
                flex: 1,
                padding: '10px 12px',
                background: THEME.goldGradient,
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: THEME.white,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: THEME.goldShadow,
                transition: 'all 0.2s ease',
              }}>
                <i className="fas fa-cart-plus" /> Add
              </button>
            </div>
          </div>

          <div style={{
            padding: '8px 14px',
            background: '#FAFAFA',
            borderTop: `1px solid ${THEME.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <span style={{ fontSize: 11, color: THEME.grayLight }}>
              {formatTime(timestamp)}
            </span>
          </div>
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: ORDER CARD
  // ═══════════════════════════════════════════════════════════════
  if (message_type === 'order' && order) {
    const o = typeof order === 'string' ? JSON.parse(order) : order;
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
    const statusConfig = STATUS_COLORS[o.status?.toLowerCase()] || STATUS_COLORS.pending;

    return (
      <MessageContainer>
        <div style={{
          background: THEME.white,
          borderRadius: 16,
          maxWidth: 280,
          overflow: 'hidden',
          boxShadow: THEME.shadowMd,
          border: `1px solid ${THEME.border}`,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            background: '#FAFAFA',
            borderBottom: `1px solid ${THEME.border}`,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: THEME.dark }}>
              🛒 {o.order_id || 'Order'}
            </span>
            <span style={{
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              background: statusConfig.bg,
              color: statusConfig.color,
              textTransform: 'capitalize',
            }}>
              {statusConfig.icon} {o.status || 'Pending'}
            </span>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div style={{
              display: 'flex',
              gap: 6,
              padding: 12,
              overflowX: 'auto',
            }}>
              {items.slice(0, 4).map((item, idx) => (
                <img
                  key={idx}
                  src={item.image_url || item.image || '/placeholder.png'}
                  alt=""
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 8,
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: `1px solid ${THEME.border}`,
                  }}
                />
              ))}
              {items.length > 4 && (
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: 8,
                  background: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: THEME.gray,
                }}>
                  +{items.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            background: THEME.cream,
            borderTop: `1px solid ${THEME.border}`,
          }}>
            <span style={{ fontSize: 13, color: THEME.gray }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: THEME.gold }}>
              {o.total ? formatCurrency(o.total) : '₹0'}
            </span>
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 14px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <span style={{ fontSize: 11, color: THEME.grayLight }}>
              {formatTime(timestamp)}
            </span>
          </div>
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: IMAGE MESSAGE
  // ═══════════════════════════════════════════════════════════════
  if (message_type === 'image' && media_url) {
    return (
      <MessageContainer>
        <div style={{
          borderRadius: 16,
          overflow: 'hidden',
          maxWidth: 280,
          boxShadow: isOutgoing ? THEME.goldShadow : THEME.shadow,
          border: isIncoming ? `1px solid ${THEME.border}` : 'none',
        }}>
          <img
            src={media_url}
            alt=""
            onLoad={() => setImageLoaded(true)}
            style={{
              width: '100%',
              maxHeight: 300,
              objectFit: 'cover',
              display: 'block',
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />

          {media_caption && (
            <div style={{
              padding: '10px 12px',
              background: isOutgoing ? THEME.goldGradient : THEME.white,
              color: isOutgoing ? THEME.white : THEME.dark,
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {media_caption}
            </div>
          )}

          <div style={{
            padding: '6px 12px',
            background: isOutgoing ? THEME.goldGradient : THEME.white,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              fontSize: 11,
              color: isOutgoing ? 'rgba(255,255,255,0.7)' : THEME.grayLight,
            }}>
              {formatTime(timestamp)}
            </span>
            {renderStatus()}
          </div>
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: DOCUMENT MESSAGE
  // ═══════════════════════════════════════════════════════════════
  if (message_type === 'document' && media_url) {
    const filename = message.filename || message.media_caption || 'Document';
    const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
    const fileConfig = FILE_ICONS[ext] || FILE_ICONS.DEFAULT;

    return (
      <MessageContainer>
        <div style={{
          background: THEME.white,
          borderRadius: 16,
          padding: 14,
          maxWidth: 280,
          boxShadow: THEME.shadow,
          border: `1px solid ${THEME.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: `${fileConfig.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <i className={`fas ${fileConfig.icon}`} style={{
                fontSize: 22,
                color: fileConfig.color,
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: THEME.dark,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {filename}
              </div>
              <div style={{ fontSize: 12, color: THEME.gray, marginTop: 2 }}>
                {ext}
              </div>
            </div>

            <a
              href={media_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: THEME.goldGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: THEME.white,
                textDecoration: 'none',
                boxShadow: THEME.goldShadow,
                transition: 'transform 0.2s ease',
              }}
            >
              <i className="fas fa-download" style={{ fontSize: 14 }} />
            </a>
          </div>

          {renderFooter(THEME.grayLight)}
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: AUDIO/VOICE MESSAGE
  // ═══════════════════════════════════════════════════════════════
  if ((message_type === 'audio' || message_type === 'voice') && media_url) {
    return (
      <MessageContainer>
        <div style={{
          background: isOutgoing ? THEME.goldGradient : THEME.white,
          borderRadius: 24,
          padding: '12px 16px',
          maxWidth: 260,
          boxShadow: isOutgoing ? THEME.goldShadow : THEME.shadow,
          border: isIncoming ? `1px solid ${THEME.border}` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isOutgoing ? 'rgba(255,255,255,0.2)' : THEME.goldGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isIncoming ? THEME.goldShadow : 'none',
            }}>
              <i className="fas fa-play" style={{
                fontSize: 16,
                color: THEME.white,
                marginLeft: 3,
              }} />
            </div>

            <div style={{
              flex: 1,
              height: 28,
              background: isOutgoing ? 'rgba(255,255,255,0.25)' : '#E5E7EB',
              borderRadius: 14,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '0%',
                background: isOutgoing ? 'rgba(255,255,255,0.6)' : THEME.gold,
                borderRadius: 14,
                transition: 'width 0.2s ease',
              }} />
            </div>

            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: isOutgoing ? 'rgba(255,255,255,0.8)' : THEME.gray,
              minWidth: 40,
            }}>
              0:00
            </span>
          </div>

          {renderFooter()}
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: INTERACTIVE REPLY (User selected a button)
  // ═══════════════════════════════════════════════════════════════
  if (message_type === 'interactive' && !hasButtons) {
    const displayText = getDisplayText();

    return (
      <MessageContainer>
        <div style={{
          background: isOutgoing ? THEME.goldGradient : THEME.white,
          borderRadius: isOutgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '10px 14px',
          maxWidth: 300,
          boxShadow: isOutgoing ? THEME.goldShadow : THEME.shadow,
          border: isIncoming ? `1px solid ${THEME.border}` : 'none',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: isOutgoing ? 'rgba(255,255,255,0.2)' : THEME.cream,
            color: isOutgoing ? THEME.white : THEME.gold,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 14,
            border: isIncoming ? `1px solid ${THEME.gold}30` : 'none',
          }}>
            <i className="fas fa-check-circle" style={{ fontSize: 14 }} />
            {displayText || button_text || 'Selected'}
          </div>

          {renderFooter()}
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: LOCATION MESSAGE
  // ═══════════════════════════════════════════════════════════════
  if (message_type === 'location') {
    return (
      <MessageContainer>
        <div style={{
          background: THEME.white,
          borderRadius: 16,
          overflow: 'hidden',
          maxWidth: 280,
          boxShadow: THEME.shadow,
          border: `1px solid ${THEME.border}`,
        }}>
          <div style={{
            height: 120,
            background: THEME.goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <i className="fas fa-map-marker-alt" style={{
              fontSize: 40,
              color: THEME.white,
            }} />
          </div>

          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: THEME.dark }}>
              📍 Location Shared
            </div>
            <div style={{ fontSize: 13, color: THEME.gray, marginTop: 4 }}>
              Tap to view on map
            </div>
          </div>

          <div style={{
            padding: '8px 12px',
            borderTop: `1px solid ${THEME.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <span style={{ fontSize: 11, color: THEME.grayLight }}>
              {formatTime(timestamp)}
            </span>
          </div>
        </div>
      </MessageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: DEFAULT TEXT MESSAGE
  // ═══════════════════════════════════════════════════════════════
  const displayText = getDisplayText();

  if (!displayText || displayText === '[Message]') {
    return null;
  }

  return (
    <MessageContainer>
      <div style={{
        background: isOutgoing ? THEME.goldGradient : THEME.white,
        color: isOutgoing ? THEME.white : THEME.dark,
        borderRadius: isOutgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '10px 14px',
        maxWidth: 320,
        boxShadow: isOutgoing ? THEME.goldShadow : THEME.shadow,
        border: isIncoming ? `1px solid ${THEME.border}` : 'none',
      }}>
        <div style={{
          fontSize: 15,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {displayText}
        </div>

        {renderFooter()}
      </div>
    </MessageContainer>
  );
});

export default ChatBubble;