/**
 * ═══════════════════════════════════════════════════════════════
 * ORDER CARD - Order Display Component
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { formatCurrency, formatRelativeTime, getInitials } from '../utils/helpers';

function OrderCard({
  order,
  onConfirm,
  onShip,
  onCancel,
  onMessage,
  onPaymentLink,
  onClick,
}) {
  if (!order) return null;

  const {
    order_id,
    customer_name,
    phone,
    items,
    item_count,
    total,
    status,
    payment_status,
    payment_method,
    shipping_city,
    created_at,
  } = order;

  const parsedItems = typeof items === 'string' ? JSON.parse(items || '[]') : items || [];

  const getStatusClass = () => {
    const classes = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
    };
    return classes[status?.toLowerCase()] || 'status-pending';
  };

  const renderActions = () => {
    const lowerStatus = status?.toLowerCase();

    if (lowerStatus === 'pending') {
      return (
        <>
          <button className="order-btn order-btn-secondary" onClick={(e) => { e.stopPropagation(); onMessage?.(); }}>
            <i className="fab fa-whatsapp"></i> Message
          </button>
          <button className="order-btn order-btn-primary" onClick={(e) => { e.stopPropagation(); onConfirm?.(); }}>
            <i className="fas fa-check"></i> Confirm
          </button>
        </>
      );
    }

    if (lowerStatus === 'confirmed') {
      return (
        <>
          {payment_status !== 'paid' && (
            <button className="order-btn order-btn-secondary" onClick={(e) => { e.stopPropagation(); onPaymentLink?.(); }}>
              <i className="fas fa-link"></i> Payment Link
            </button>
          )}
          <button className="order-btn order-btn-primary" onClick={(e) => { e.stopPropagation(); onShip?.(); }}>
            <i className="fas fa-truck"></i> Ship
          </button>
        </>
      );
    }

    if (lowerStatus === 'shipped') {
      return (
        <>
          <button className="order-btn order-btn-secondary" onClick={(e) => { e.stopPropagation(); }}>
            <i className="fas fa-map-marker-alt"></i> Track
          </button>
          <button className="order-btn order-btn-primary" onClick={(e) => { e.stopPropagation(); onMessage?.(); }}>
            <i className="fab fa-whatsapp"></i> Update
          </button>
        </>
      );
    }

    if (lowerStatus === 'delivered') {
      return (
        <>
          <button className="order-btn order-btn-secondary" onClick={(e) => { e.stopPropagation(); }}>
            <i className="fas fa-star"></i> Get Review
          </button>
          <button className="order-btn order-btn-primary" onClick={(e) => { e.stopPropagation(); onMessage?.(); }}>
            <i className="fas fa-redo"></i> Reorder
          </button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="order-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="order-top">
        <div>
          <div className="order-id">{order_id}</div>
          <div className="order-date">
            {created_at ? formatRelativeTime(created_at) : ''}
          </div>
        </div>
        <span className={`order-status ${getStatusClass()}`}>
          {status}
        </span>
      </div>

      <div className="order-customer">
        <div className="order-customer-avatar">
          {getInitials(customer_name)}
        </div>
        <div className="order-customer-info">
          <div className="order-customer-name">{customer_name || phone}</div>
          <div className="order-customer-phone">
            {phone} {shipping_city ? `• ${shipping_city}` : ''}
          </div>
        </div>
      </div>

      {parsedItems.length > 0 && (
        <div className="order-products">
          {parsedItems.slice(0, 4).map((item, idx) => (
            <img
              key={idx}
              src={item.image_url || item.image || '/placeholder-product.png'}
              className="order-product-img"
              alt=""
            />
          ))}
          {parsedItems.length > 4 && (
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 'var(--radius)',
                background: 'var(--cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--gold-dark)',
              }}
            >
              +{parsedItems.length - 4}
            </div>
          )}
        </div>
      )}

      <div className="order-bottom">
        <span className="order-meta">
          {item_count || parsedItems.length} item(s) • {payment_method || 'N/A'}
          {payment_status === 'paid' && (
            <span style={{ color: 'var(--success)', marginLeft: 4 }}>✓ Paid</span>
          )}
        </span>
        <span className="order-total">
          {formatCurrency(total)}
        </span>
      </div>

      <div className="order-actions" onClick={(e) => e.stopPropagation()}>
        {renderActions()}
      </div>
    </div>
  );
}

export default OrderCard;
