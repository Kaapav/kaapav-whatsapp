
/**
 * ═══════════════════════════════════════════════════════════════
 * CUSTOMER PANEL - Slide-in Customer Details
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatRelativeTime, getInitials } from '../utils/helpers';
import { chatAPI } from '../api';
import { useUIStore } from '../store';

function CustomerPanel({ customer, chat, isOpen, onClose, onRefresh }) {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  if (!customer && !chat) return null;

  const data = customer || chat;
  const labels = typeof data.labels === 'string' ? JSON.parse(data.labels || '[]') : data.labels || [];
  const recentOrders = data.recent_orders || [];

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsSavingNote(true);
    try {
      await chatAPI.addNote(data.phone, newNote);
      showToast('Note added', 'success');
      setNewNote('');
      onRefresh?.();
    } catch (err) {
      showToast('Failed to add note', 'error');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleViewOrders = () => {
    navigate(`/orders?customer=${data.phone}`);
    onClose();
  };

  return (
    <div className={`customer-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <span className="panel-title">Customer Info</span>
        <button className="panel-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="panel-content">
        {/* Profile */}
        <div className="customer-profile">
          <div className="customer-avatar-lg">
            {data.avatar ? (
              <img src={data.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              getInitials(data.name || data.customer_name)
            )}
          </div>
          <div className="customer-name-lg">{data.name || data.customer_name || data.phone}</div>
          <div className="customer-phone-lg">{data.phone}</div>
          {labels.length > 0 && (
            <div className="customer-tags">
              {labels.map((label, idx) => (
                <span key={idx} className="customer-tag">{label}</span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="customer-actions-row">
          <button className="customer-action-btn whatsapp">
            <i className="fab fa-whatsapp"></i>
            <span>Chat</span>
          </button>
          <button
            className="customer-action-btn call"
            onClick={() => window.open(`tel:${data.phone}`, '_self')}
          >
            <i className="fas fa-phone"></i>
            <span>Call</span>
          </button>
          <button className="customer-action-btn email">
            <i className="fas fa-envelope"></i>
            <span>Email</span>
          </button>
        </div>

        {/* Stats */}
        <div className="panel-section">
          <div className="panel-section-header">
            <span className="panel-section-title">Statistics</span>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{data.order_count || 0}</div>
              <div className="stat-label">Orders</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {data.total_spent ? formatCurrency(data.total_spent) : '₹0'}
              </div>
              <div className="stat-label">Total Spent</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{data.segment || 'New'}</div>
              <div className="stat-label">Segment</div>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <div className="panel-section">
            <div className="panel-section-header">
              <span className="panel-section-title">Recent Orders</span>
              <span className="panel-section-link" onClick={handleViewOrders}>
                View All
              </span>
            </div>
            <div className="recent-orders-list">
              {recentOrders.slice(0, 3).map((order, idx) => (
                <div
                  key={idx}
                  className="recent-order-item"
                  onClick={() => {
                    navigate(`/orders/${order.order_id}`);
                    onClose();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {order.image && (
                    <img src={order.image} className="recent-order-img" alt="" />
                  )}
                  <div className="recent-order-info">
                    <div className="recent-order-id">{order.order_id}</div>
                    <div className="recent-order-date">
                      {order.created_at ? formatRelativeTime(order.created_at) : order.date}
                    </div>
                  </div>
                  <div className="recent-order-amount">
                    {formatCurrency(order.total || order.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Info */}
        {(data.address || data.city || data.email) && (
          <div className="panel-section">
            <div className="panel-section-header">
              <span className="panel-section-title">Details</span>
            </div>
            <div style={{ background: 'var(--off-white)', borderRadius: 'var(--radius)', padding: 12 }}>
              {data.email && (
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <i className="fas fa-envelope" style={{ width: 20, color: 'var(--gray)' }}></i>
                  {data.email}
                </div>
              )}
              {data.address && (
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <i className="fas fa-map-marker-alt" style={{ width: 20, color: 'var(--gray)' }}></i>
                  {data.address}
                  {data.city && `, ${data.city}`}
                  {data.pincode && ` - ${data.pincode}`}
                </div>
              )}
              {data.first_seen && (
                <div style={{ fontSize: 13 }}>
                  <i className="fas fa-calendar" style={{ width: 20, color: 'var(--gray)' }}></i>
                  Customer since {formatRelativeTime(data.first_seen)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="panel-section">
          <div className="panel-section-header">
            <span className="panel-section-title">Notes</span>
          </div>
          {data.notes && (
            <div className="notes-box">
              <div className="notes-text">{data.notes}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 13,
              }}
            />
            <button
              className="add-note-btn"
              onClick={handleAddNote}
              disabled={isSavingNote || !newNote.trim()}
              style={{ padding: '10px 16px' }}
            >
              {isSavingNote ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-plus"></i>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerPanel;
