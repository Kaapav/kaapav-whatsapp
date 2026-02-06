/**
 * ═══════════════════════════════════════════════════════════════
 * ORDER DETAIL SCREEN - Complete Order View & Management
 * View order details, customer info, items, timeline, actions
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore, useUIStore } from '../store';
import { orderAPI, messageAPI, shippingAPI } from '../api';
import { formatCurrency, formatRelativeTime, getInitials } from '../utils/helpers';
import Modal from '../components/Modal';

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  pending: { 
    color: 'var(--warning)', 
    bg: 'var(--warning-light)', 
    icon: 'fa-clock',
    label: 'Pending'
  },
  confirmed: { 
    color: 'var(--info)', 
    bg: 'var(--info-light)', 
    icon: 'fa-check-circle',
    label: 'Confirmed'
  },
  processing: { 
    color: 'var(--gold-dark)', 
    bg: 'var(--cream)', 
    icon: 'fa-cog',
    label: 'Processing'
  },
  shipped: { 
    color: 'var(--primary)', 
    bg: 'var(--primary-light)', 
    icon: 'fa-truck',
    label: 'Shipped'
  },
  delivered: { 
    color: 'var(--success)', 
    bg: 'var(--success-light)', 
    icon: 'fa-check-double',
    label: 'Delivered'
  },
  cancelled: { 
    color: 'var(--danger)', 
    bg: 'var(--danger-light)', 
    icon: 'fa-times-circle',
    label: 'Cancelled'
  },
};

const PAYMENT_STATUS_CONFIG = {
  pending: { color: 'var(--warning)', label: 'Payment Pending' },
  paid: { color: 'var(--success)', label: 'Paid' },
  failed: { color: 'var(--danger)', label: 'Payment Failed' },
  refunded: { color: 'var(--gray)', label: 'Refunded' },
  cod: { color: 'var(--info)', label: 'Cash on Delivery' },
};

function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // Store
  const { updateOrder } = useOrderStore();
  const { showToast } = useUIStore();

  // Local state
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNote, setNewNote] = useState('');

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await orderAPI.getOrder(orderId);
      if (response?.order) {
        setOrder(response.order);
        
        // Fetch tracking if shipped
        if (response.order.status === 'shipped' && response.order.tracking_id) {
          fetchTracking(response.order.tracking_id);
        }
      } else {
        showToast('Order not found', 'error');
        navigate('/orders');
      }
    } catch (err) {
      console.error('Failed to fetch order:', err);
      showToast('Failed to load order', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // Fetch tracking info
  const fetchTracking = async (trackingId) => {
    try {
      const response = await shippingAPI.getTracking(trackingId);
      if (response?.tracking) {
        setTrackingInfo(response.tracking);
      }
    } catch (err) {
      console.error('Failed to fetch tracking:', err);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Parse items
  const parsedItems = order?.items 
    ? (typeof order.items === 'string' ? JSON.parse(order.items) : order.items)
    : [];

  // Get status config
  const statusConfig = STATUS_CONFIG[order?.status?.toLowerCase()] || STATUS_CONFIG.pending;
  const paymentConfig = PAYMENT_STATUS_CONFIG[order?.payment_status] || PAYMENT_STATUS_CONFIG.pending;

  // ═══════════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleConfirmOrder = async () => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.confirm(order.order_id);
      
      if (response.success) {
        const updatedOrder = { 
          ...order, 
          status: 'confirmed', 
          confirmed_at: new Date().toISOString() 
        };
        setOrder(updatedOrder);
        updateOrder(order.order_id, updatedOrder);
        
        // Send WhatsApp notification
        await messageAPI.sendTemplate(order.phone, 'order_confirmed', [
          order.order_id,
          formatCurrency(order.total),
        ]);
        
        showToast('Order confirmed & customer notified! ✅', 'success');
      }
    } catch (err) {
      showToast('Failed to confirm order', 'error');
    } finally {
      setIsProcessing(false);
      setActionModal(null);
    }
  };

  const handleShipOrder = async (trackingData) => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.ship(order.order_id, trackingData);
      
      if (response.success) {
        const updatedOrder = {
          ...order,
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          tracking_id: trackingData.tracking_id,
          courier: trackingData.courier,
        };
        setOrder(updatedOrder);
        updateOrder(order.order_id, updatedOrder);
        
        // Send WhatsApp notification with tracking
        await messageAPI.sendTemplate(order.phone, 'order_shipped', [
          order.order_id,
          trackingData.tracking_id,
          trackingData.courier,
        ]);
        
        showToast('Order shipped & tracking sent! 🚚', 'success');
      }
    } catch (err) {
      showToast('Failed to ship order', 'error');
    } finally {
      setIsProcessing(false);
      setActionModal(null);
    }
  };

  const handleCancelOrder = async (reason) => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.cancel(order.order_id, reason);
      
      if (response.success) {
        const updatedOrder = {
          ...order,
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        };
        setOrder(updatedOrder);
        updateOrder(order.order_id, updatedOrder);
        
        showToast('Order cancelled', 'success');
      }
    } catch (err) {
      showToast('Failed to cancel order', 'error');
    } finally {
      setIsProcessing(false);
      setActionModal(null);
    }
  };

  const handleCreatePaymentLink = async () => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.createPaymentLink(order.order_id);
      
      if (response.payment_link) {
        await messageAPI.sendText(
          order.phone,
          `💳 Payment Link for Order ${order.order_id}\n\n` +
          `Amount: ${formatCurrency(order.total)}\n\n` +
          `Pay here: ${response.payment_link}\n\n` +
          `Link expires in 24 hours.`
        );
        
        showToast('Payment link sent! 💳', 'success');
      }
    } catch (err) {
      showToast('Failed to create payment link', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setIsProcessing(true);
    try {
      await orderAPI.addNote(order.order_id, newNote);
      
      const notes = order.notes ? JSON.parse(order.notes) : [];
      notes.push({
        text: newNote,
        created_at: new Date().toISOString(),
      });
      
      setOrder({ ...order, notes: JSON.stringify(notes) });
      setNewNote('');
      setShowNoteInput(false);
      showToast('Note added', 'success');
    } catch (err) {
      showToast('Failed to add note', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMessageCustomer = () => {
    navigate(`/chat/${order.phone}`);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOADING STATE
  // ═══════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="screen">
        <div className="header">
          <button className="header-btn" onClick={() => navigate('/orders')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="header-title">Order Details</h1>
        </div>
        <div className="screen-content" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 100, marginBottom: 16, borderRadius: 12 }}></div>
          <div className="skeleton" style={{ height: 80, marginBottom: 16, borderRadius: 12 }}></div>
          <div className="skeleton" style={{ height: 200, marginBottom: 16, borderRadius: 12 }}></div>
          <div className="skeleton" style={{ height: 120, borderRadius: 12 }}></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="screen">
        <div className="header">
          <button className="header-btn" onClick={() => navigate('/orders')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="header-title">Order Details</h1>
        </div>
        <div className="empty-state">
          <i className="fas fa-exclamation-circle"></i>
          <p>Order not found</p>
        </div>
      </div>
    );
  }

  // Parse notes
  const notes = order.notes ? JSON.parse(order.notes) : [];

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <button className="header-btn" onClick={() => navigate('/orders')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="header-title">{order.order_id}</h1>
        <div className="header-actions">
          <button 
            className="header-btn header-btn-dark"
            onClick={() => window.print()}
          >
            <i className="fas fa-print"></i>
          </button>
          <button 
            className="header-btn header-btn-dark"
            onClick={fetchOrder}
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      <div className="screen-content" style={{ paddingBottom: 100 }}>
        {/* Status Banner */}
        <div style={{
          background: statusConfig.bg,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: statusConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <i className={`fas ${statusConfig.icon}`} style={{ color: 'white', fontSize: 16 }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: statusConfig.color }}>
                {statusConfig.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray)' }}>
                {order.created_at && formatRelativeTime(order.created_at)}
              </div>
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: 20,
            background: paymentConfig.color + '20',
            color: paymentConfig.color,
            fontSize: 12,
            fontWeight: 600,
          }}>
            {paymentConfig.label}
          </div>
        </div>

        {/* Customer Section */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Customer</h3>
            <button 
              className="section-action"
              onClick={handleMessageCustomer}
            >
              <i className="fab fa-whatsapp"></i> Chat
            </button>
          </div>
          <div className="customer-row" onClick={handleMessageCustomer}>
            <div className="customer-avatar">
              {getInitials(order.customer_name)}
            </div>
            <div className="customer-info">
              <div className="customer-name">{order.customer_name || 'Unknown'}</div>
              <div className="customer-phone">{order.phone}</div>
            </div>
            <i className="fas fa-chevron-right" style={{ color: 'var(--gray)' }}></i>
          </div>
        </div>

        {/* Items Section */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Items ({parsedItems.length})</h3>
          </div>
          <div className="items-list">
            {parsedItems.map((item, idx) => (
              <div key={idx} className="item-row">
                <img 
                  src={item.image_url || item.image || '/placeholder-product.png'} 
                  alt={item.name}
                  className="item-image"
                />
                <div className="item-details">
                  <div className="item-name">{item.name || item.product_name}</div>
                  <div className="item-meta">
                    {item.variant && <span>{item.variant} • </span>}
                    Qty: {item.quantity}
                  </div>
                </div>
                <div className="item-price">
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
          
          {/* Order Summary */}
          <div className="order-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal || order.total)}</span>
            </div>
            {order.discount > 0 && (
              <div className="summary-row discount">
                <span>Discount</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            {order.shipping_charge > 0 && (
              <div className="summary-row">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping_charge)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        {order.shipping_address && (
          <div className="detail-section">
            <div className="section-header">
              <h3>Shipping Address</h3>
            </div>
            <div className="address-card">
              <i className="fas fa-map-marker-alt" style={{ color: 'var(--gold-dark)' }}></i>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{order.customer_name}</div>
                <div style={{ color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>
                  {order.shipping_address}
                  {order.shipping_city && `, ${order.shipping_city}`}
                  {order.shipping_state && `, ${order.shipping_state}`}
                  {order.shipping_pincode && ` - ${order.shipping_pincode}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tracking Section (if shipped) */}
        {order.status === 'shipped' && order.tracking_id && (
          <div className="detail-section">
            <div className="section-header">
              <h3>Tracking</h3>
              <button 
                className="section-action"
                onClick={() => fetchTracking(order.tracking_id)}
              >
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>
            <div className="tracking-card">
              <div className="tracking-row">
                <span className="tracking-label">Courier</span>
                <span className="tracking-value">{order.courier || 'N/A'}</span>
              </div>
              <div className="tracking-row">
                <span className="tracking-label">Tracking ID</span>
                <span className="tracking-value" style={{ fontFamily: 'monospace' }}>
                  {order.tracking_id}
                </span>
              </div>
              {trackingInfo && (
                <>
                  <div className="tracking-row">
                    <span className="tracking-label">Status</span>
                    <span className="tracking-value">{trackingInfo.current_status}</span>
                  </div>
                  <div className="tracking-row">
                    <span className="tracking-label">Location</span>
                    <span className="tracking-value">{trackingInfo.current_location || 'In Transit'}</span>
                  </div>
                  {trackingInfo.expected_delivery && (
                    <div className="tracking-row">
                      <span className="tracking-label">Expected Delivery</span>
                      <span className="tracking-value" style={{ color: 'var(--success)' }}>
                        {new Date(trackingInfo.expected_delivery).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Timeline</h3>
          </div>
          <div className="timeline">
            <TimelineItem
              icon="fa-shopping-cart"
              title="Order Placed"
              time={order.created_at}
              isActive={true}
            />
            {order.confirmed_at && (
              <TimelineItem
                icon="fa-check-circle"
                title="Order Confirmed"
                time={order.confirmed_at}
                isActive={true}
              />
            )}
            {order.shipped_at && (
              <TimelineItem
                icon="fa-truck"
                title="Shipped"
                subtitle={order.tracking_id ? `Tracking: ${order.tracking_id}` : null}
                time={order.shipped_at}
                isActive={true}
              />
            )}
            {order.delivered_at && (
              <TimelineItem
                icon="fa-check-double"
                title="Delivered"
                time={order.delivered_at}
                isActive={true}
                isLast={true}
              />
            )}
            {order.cancelled_at && (
              <TimelineItem
                icon="fa-times-circle"
                title="Cancelled"
                subtitle={order.cancellation_reason}
                time={order.cancelled_at}
                isActive={true}
                isLast={true}
                isDanger={true}
              />
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Notes</h3>
            <button 
              className="section-action"
              onClick={() => setShowNoteInput(!showNoteInput)}
            >
              <i className="fas fa-plus"></i> Add
            </button>
          </div>
          
          {showNoteInput && (
            <div style={{ marginBottom: 12 }}>
              <textarea
                className="form-input"
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                style={{ resize: 'none', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowNoteInput(false);
                    setNewNote('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-gold btn-sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isProcessing}
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
          
          {notes.length > 0 ? (
            <div className="notes-list">
              {notes.map((note, idx) => (
                <div key={idx} className="note-item">
                  <div className="note-text">{note.text}</div>
                  <div className="note-time">{formatRelativeTime(note.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            !showNoteInput && (
              <p style={{ color: 'var(--gray)', fontSize: 13 }}>No notes yet</p>
            )
          )}
        </div>

        {/* Payment Info */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Payment</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Method</span>
              <span className="info-value">{order.payment_method || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className="info-value" style={{ color: paymentConfig.color }}>
                {paymentConfig.label}
              </span>
            </div>
            {order.payment_id && (
              <div className="info-item">
                <span className="info-label">Payment ID</span>
                <span className="info-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {order.payment_id}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      {order.status !== 'cancelled' && order.status !== 'delivered' && (
        <div className="bottom-action-bar">
          {order.status === 'pending' && (
            <>
              <button 
                className="btn btn-ghost"
                onClick={() => setActionModal('cancel')}
              >
                Cancel
              </button>
              <button 
                className="btn btn-gold"
                onClick={() => setActionModal('confirm')}
              >
                <i className="fas fa-check"></i> Confirm Order
              </button>
            </>
          )}
          
          {order.status === 'confirmed' && (
            <>
              {order.payment_status !== 'paid' && (
                <button 
                  className="btn btn-ghost"
                  onClick={handleCreatePaymentLink}
                  disabled={isProcessing}
                >
                  <i className="fas fa-link"></i> Payment Link
                </button>
              )}
              <button 
                className="btn btn-gold"
                onClick={() => setActionModal('ship')}
              >
                <i className="fas fa-truck"></i> Ship Order
              </button>
            </>
          )}
          
          {order.status === 'shipped' && (
            <>
              <button 
                className="btn btn-ghost"
                onClick={handleMessageCustomer}
              >
                <i className="fab fa-whatsapp"></i> Update Customer
              </button>
              <button 
                className="btn btn-gold"
                onClick={() => {
                  // Mark as delivered
                }}
              >
                <i className="fas fa-check-double"></i> Mark Delivered
              </button>
            </>
          )}
        </div>
      )}

      {/* Action Modals */}
      {actionModal === 'confirm' && (
        <ConfirmModal
          order={order}
          isProcessing={isProcessing}
          onConfirm={handleConfirmOrder}
          onClose={() => setActionModal(null)}
        />
      )}

      {actionModal === 'ship' && (
        <ShipModal
          order={order}
          isProcessing={isProcessing}
          onShip={handleShipOrder}
          onClose={() => setActionModal(null)}
        />
      )}

      {actionModal === 'cancel' && (
        <CancelModal
          order={order}
          isProcessing={isProcessing}
          onCancel={handleCancelOrder}
          onClose={() => setActionModal(null)}
        />
      )}

      {/* Inline Styles */}
      <style>{`
        .detail-section {
          background: var(--white);
          margin: 12px 16px;
          border-radius: var(--radius-lg);
          padding: 16px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .section-header h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--dark);
        }
        
        .section-action {
          background: none;
          border: none;
          color: var(--gold-dark);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .customer-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          cursor: pointer;
        }
        
        .customer-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--gold-gradient);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
        }
        
        .customer-info {
          flex: 1;
        }
        
        .customer-name {
          font-weight: 600;
          font-size: 15px;
        }
        
        .customer-phone {
          color: var(--gray);
          font-size: 13px;
        }
        
        .items-list {
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
          margin-bottom: 12px;
        }
        
        .item-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }
        
        .item-image {
          width: 56px;
          height: 56px;
          border-radius: var(--radius);
          object-fit: cover;
          background: var(--off-white);
        }
        
        .item-details {
          flex: 1;
        }
        
        .item-name {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 2px;
        }
        
        .item-meta {
          color: var(--gray);
          font-size: 12px;
        }
        
        .item-price {
          font-weight: 700;
          font-size: 14px;
          color: var(--gold-dark);
        }
        
        .order-summary {
          padding-top: 8px;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 14px;
        }
        
        .summary-row.discount {
          color: var(--success);
        }
        
        .summary-row.total {
          border-top: 1px solid var(--border);
          margin-top: 8px;
          padding-top: 12px;
          font-weight: 700;
          font-size: 16px;
        }
        
        .summary-row.total span:last-child {
          color: var(--gold-dark);
        }
        
        .address-card {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: var(--off-white);
          border-radius: var(--radius);
        }
        
        .tracking-card {
          background: var(--off-white);
          border-radius: var(--radius);
          padding: 12px;
        }
        
        .tracking-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
        
        .tracking-row:last-child {
          border-bottom: none;
        }
        
        .tracking-label {
          color: var(--gray);
          font-size: 13px;
        }
        
        .tracking-value {
          font-weight: 600;
          font-size: 13px;
        }
        
        .timeline {
          position: relative;
          padding-left: 24px;
        }
        
        .timeline-item {
          position: relative;
          padding-bottom: 20px;
          padding-left: 20px;
        }
        
        .timeline-item::before {
          content: '';
          position: absolute;
          left: -24px;
          top: 24px;
          bottom: 0;
          width: 2px;
          background: var(--border);
        }
        
        .timeline-item.last::before {
          display: none;
        }
        
        .timeline-icon {
          position: absolute;
          left: -32px;
          top: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--success);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .timeline-icon i {
          color: white;
          font-size: 10px;
        }
        
        .timeline-icon.danger {
          background: var(--danger);
        }
        
        .timeline-title {
          font-weight: 600;
          font-size: 14px;
        }
        
        .timeline-subtitle {
          color: var(--gray);
          font-size: 12px;
          margin-top: 2px;
        }
        
        .timeline-time {
          color: var(--gray);
          font-size: 11px;
          margin-top: 4px;
        }
        
        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .note-item {
          background: var(--cream);
          padding: 10px 12px;
          border-radius: var(--radius);
          border-left: 3px solid var(--gold);
        }
        
        .note-text {
          font-size: 13px;
          color: var(--dark);
        }
        
        .note-time {
          font-size: 11px;
          color: var(--gray);
          margin-top: 4px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .info-label {
          font-size: 12px;
          color: var(--gray);
        }
        
        .info-value {
          font-weight: 600;
          font-size: 14px;
        }
        
        .bottom-action-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--white);
          padding: 12px 16px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          display: flex;
          gap: 12px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
          z-index: 100;
        }
        
        .bottom-action-bar .btn {
          flex: 1;
        }
        
        .btn-sm {
          padding: 8px 16px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════

function TimelineItem({ icon, title, subtitle, time, isActive, isLast, isDanger }) {
  return (
    <div className={`timeline-item ${isLast ? 'last' : ''}`}>
      <div className={`timeline-icon ${isDanger ? 'danger' : ''}`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="timeline-title">{title}</div>
      {subtitle && <div className="timeline-subtitle">{subtitle}</div>}
      {time && <div className="timeline-time">{formatRelativeTime(time)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════

function ConfirmModal({ order, isProcessing, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Order" onClose={onClose}>
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'var(--success-light)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="fas fa-check" style={{ fontSize: 24, color: 'var(--success)' }}></i>
        </div>
        <h3 style={{ marginBottom: 8 }}>Confirm Order?</h3>
        <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 20 }}>
          Customer will be notified via WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button 
            className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
            onClick={onConfirm}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            <span className="btn-text">Confirm</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHIP MODAL
// ═══════════════════════════════════════════════════════════════

function ShipModal({ order, isProcessing, onShip, onClose }) {
  const [courier, setCourier] = useState('');
  const [trackingId, setTrackingId] = useState('');

  return (
    <Modal title="Ship Order" onClose={onClose}>
      <div style={{ padding: 20 }}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Courier Partner</label>
          <select 
            className="form-input" 
            value={courier} 
            onChange={(e) => setCourier(e.target.value)}
          >
            <option value="">Select courier</option>
            <option value="shiprocket">Shiprocket</option>
            <option value="delhivery">Delhivery</option>
            <option value="bluedart">Blue Dart</option>
            <option value="dtdc">DTDC</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Tracking ID / AWB</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter tracking number"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button 
            className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
            onClick={() => onShip({ courier, tracking_id: trackingId })}
            disabled={isProcessing || !courier || !trackingId}
            style={{ flex: 1 }}
          >
            <span className="btn-text"><i className="fas fa-truck"></i> Ship</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// CANCEL MODAL
// ═══════════════════════════════════════════════════════════════

function CancelModal({ order, isProcessing, onCancel, onClose }) {
  const [reason, setReason] = useState('');
  const reasons = [
    'Customer requested cancellation',
    'Out of stock',
    'Payment failed',
    'Duplicate order',
    'Fraudulent order',
    'Other',
  ];

  return (
    <Modal title="Cancel Order" onClose={onClose}>
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'var(--danger-light)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="fas fa-times" style={{ fontSize: 24, color: 'var(--danger)' }}></i>
        </div>
        <h3 style={{ marginBottom: 8 }}>Cancel Order?</h3>
        <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 16 }}>
          This action cannot be undone.
        </p>
        <div className="form-group" style={{ marginBottom: 20, textAlign: 'left' }}>
          <label className="form-label">Reason</label>
          <select 
            className="form-input" 
            value={reason} 
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">Select reason</option>
            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Go Back
          </button>
          <button 
            className={`btn ${isProcessing ? 'loading' : ''}`}
            onClick={() => onCancel(reason)}
            disabled={isProcessing || !reason}
            style={{ flex: 1, background: 'var(--danger)', color: 'white' }}
          >
            <span className="btn-text">Cancel Order</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default OrderDetail;
