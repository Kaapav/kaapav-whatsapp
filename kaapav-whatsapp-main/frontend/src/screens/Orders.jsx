/**
 * ═══════════════════════════════════════════════════════════════
 * ORDERS SCREEN - Complete Order Management
 * Filter, Search, Quick Actions, Status Updates
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrderStore, useUIStore } from '../store';
import { orderAPI, messageAPI } from '../api';
import { formatCurrency, formatRelativeTime, getInitials } from '../utils/helpers';
import PullToRefresh from '../components/PullToRefresh';
import OrderCard from '../components/OrderCard';
import Modal from '../components/Modal';

// Status filter definitions
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

function Orders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Store
  const {
    orders,
    setOrders,
    updateOrder,
    pendingCount,
    isLoading,
    setLoading,
    filters,
    setFilters,
    getFilteredOrders,
  } = useOrderStore();
  const { showToast } = useUIStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState(searchParams.get('status') || 'all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionModal, setActionModal] = useState(null); // 'confirm', 'ship', 'cancel'
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await orderAPI.getOrders({ limit: 100 });
      if (response?.orders) {
        setOrders(response.orders);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Apply filters
  useEffect(() => {
    setFilters({ status: activeStatus, search: searchQuery });
  }, [activeStatus, searchQuery]);

  // Get filtered orders
  const filteredOrders = useMemo(() => {
    let result = orders || [];

    // Status filter
    if (activeStatus !== 'all') {
      result = result.filter((o) => o.status === activeStatus);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((o) =>
        o.order_id?.toLowerCase().includes(query) ||
        o.customer_name?.toLowerCase().includes(query) ||
        o.phone?.includes(query)
      );
    }

    // Sort by date (newest first)
    return result.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  }, [orders, activeStatus, searchQuery]);

  // Get status counts
  const getStatusCount = (status) => {
    if (!orders?.length) return 0;
    if (status === 'all') return orders.length;
    return orders.filter((o) => o.status === status).length;
  };

  // Handle status filter change
  const handleStatusChange = (status) => {
    setActiveStatus(status);
    setSearchParams(status === 'all' ? {} : { status });
  };

  // Handle order confirmation
  const handleConfirmOrder = async (order) => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.confirm(order.order_id);
      
      if (response.success) {
        updateOrder(order.order_id, { status: 'confirmed', confirmed_at: new Date().toISOString() });
        
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
      setSelectedOrder(null);
    }
  };

  // Handle order shipping
  const handleShipOrder = async (order, trackingData) => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.ship(order.order_id, trackingData);
      
      if (response.success) {
        updateOrder(order.order_id, {
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          tracking_id: trackingData.tracking_id,
          courier: trackingData.courier,
        });
        
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
      setSelectedOrder(null);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async (order, reason) => {
    setIsProcessing(true);
    try {
      const response = await orderAPI.cancel(order.order_id, reason);
      
      if (response.success) {
        updateOrder(order.order_id, {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        });
        
        showToast('Order cancelled', 'success');
      }
    } catch (err) {
      showToast('Failed to cancel order', 'error');
    } finally {
      setIsProcessing(false);
      setActionModal(null);
      setSelectedOrder(null);
    }
  };

  // Handle message customer
  const handleMessageCustomer = (order) => {
    navigate(`/chat/${order.phone}`);
  };

  // Handle create payment link
  const handleCreatePaymentLink = async (order) => {
    try {
      const response = await orderAPI.createPaymentLink(order.order_id);
      
      if (response.payment_link) {
        // Send payment link via WhatsApp
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
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    await fetchOrders();
  };

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <h1 className="header-title">Orders</h1>
        <div className="header-actions">
          <button className="header-btn header-btn-dark">
            <i className="fas fa-search"></i>
          </button>
          <button className="header-btn header-btn-dark">
            <i className="fas fa-filter"></i>
          </button>
          <button
            className="header-btn header-btn-dark"
            onClick={() => navigate('/orders/new')}
          >
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <div className="screen-content with-nav">
        <PullToRefresh onRefresh={handleRefresh} isRefreshing={isLoading}>
          {/* Status Pills */}
          <div className="pills">
            {STATUS_FILTERS.map((filter) => {
              const count = getStatusCount(filter.key);
              return (
                <div
                  key={filter.key}
                  className={`pill ${activeStatus === filter.key ? 'active' : ''}`}
                  onClick={() => handleStatusChange(filter.key)}
                >
                  {filter.label} {count > 0 ? `(${count})` : ''}
                </div>
              );
            })}
          </div>

          {/* Search Bar (inline) */}
          <div style={{ padding: '12px 16px 0' }}>
            <div className="search-bar" style={{ background: 'var(--white)' }}>
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <i className="fas fa-times" style={{ color: 'var(--gray)' }}></i>
                </button>
              )}
            </div>
          </div>

          {/* Orders List */}
          <div className="orders-list">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <OrderCard
                  key={order.order_id}
                  order={order}
                  onConfirm={() => {
                    setSelectedOrder(order);
                    setActionModal('confirm');
                  }}
                  onShip={() => {
                    setSelectedOrder(order);
                    setActionModal('ship');
                  }}
                  onCancel={() => {
                    setSelectedOrder(order);
                    setActionModal('cancel');
                  }}
                  onMessage={() => handleMessageCustomer(order)}
                  onPaymentLink={() => handleCreatePaymentLink(order)}
                  onClick={() => navigate(`/orders/${order.order_id}`)}
                />
              ))
            ) : (
              <div className="empty-state">
                <i className="fas fa-shopping-bag"></i>
                <p>
                  {searchQuery
                    ? `No orders matching "${searchQuery}"`
                    : activeStatus !== 'all'
                    ? `No ${activeStatus} orders`
                    : 'No orders yet'}
                </p>
              </div>
            )}
          </div>

          {/* Loading Skeletons */}
          {isLoading && orders.length === 0 && (
            <div style={{ padding: '16px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="order-card" style={{ marginBottom: '12px' }}>
                  <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 8 }}></div>
                  <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 16 }}></div>
                  <div className="skeleton" style={{ height: 60, width: '100%' }}></div>
                </div>
              ))}
            </div>
          )}
        </PullToRefresh>
      </div>

      {/* Action Modals */}
      {actionModal === 'confirm' && selectedOrder && (
        <ConfirmOrderModal
          order={selectedOrder}
          isProcessing={isProcessing}
          onConfirm={() => handleConfirmOrder(selectedOrder)}
          onClose={() => {
            setActionModal(null);
            setSelectedOrder(null);
          }}
        />
      )}

      {actionModal === 'ship' && selectedOrder && (
        <ShipOrderModal
          order={selectedOrder}
          isProcessing={isProcessing}
          onShip={(trackingData) => handleShipOrder(selectedOrder, trackingData)}
          onClose={() => {
            setActionModal(null);
            setSelectedOrder(null);
          }}
        />
      )}

      {actionModal === 'cancel' && selectedOrder && (
        <CancelOrderModal
          order={selectedOrder}
          isProcessing={isProcessing}
          onCancel={(reason) => handleCancelOrder(selectedOrder, reason)}
          onClose={() => {
            setActionModal(null);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM ORDER MODAL
// ═══════════════════════════════════════════════════════════════

function ConfirmOrderModal({ order, isProcessing, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Order" onClose={onClose}>
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: 60,
            height: 60,
            background: 'var(--success-light)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <i className="fas fa-check" style={{ fontSize: 24, color: 'var(--success)' }}></i>
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Confirm Order?</h3>
          <p style={{ color: 'var(--gray)', fontSize: 14 }}>
            Order <strong>{order.order_id}</strong> will be confirmed and customer will be notified.
          </p>
        </div>

        <div style={{
          background: 'var(--off-white)',
          borderRadius: 'var(--radius)',
          padding: '12px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Customer</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{order.customer_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Items</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{order.item_count} item(s)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold-dark)' }}>
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
            onClick={onConfirm}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            <span className="btn-text">Confirm Order</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHIP ORDER MODAL
// ═══════════════════════════════════════════════════════════════

function ShipOrderModal({ order, isProcessing, onShip, onClose }) {
  const [courier, setCourier] = useState('');
  const [trackingId, setTrackingId] = useState('');

  const handleSubmit = () => {
    if (!courier || !trackingId) {
      return;
    }
    onShip({ courier, tracking_id: trackingId });
  };

  return (
    <Modal title="Ship Order" onClose={onClose}>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 16 }}>
            Enter shipping details for order <strong>{order.order_id}</strong>
          </p>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Courier Partner</label>
            <select
              className="form-input"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              style={{ paddingLeft: 16 }}
            >
              <option value="">Select courier</option>
              <option value="shiprocket">Shiprocket</option>
              <option value="delhivery">Delhivery</option>
              <option value="bluedart">Blue Dart</option>
              <option value="dtdc">DTDC</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tracking ID / AWB Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter tracking number"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              style={{ paddingLeft: 16 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={isProcessing || !courier || !trackingId}
            style={{ flex: 1 }}
          >
            <span className="btn-text">
              <i className="fas fa-truck" style={{ marginRight: 6 }}></i>
              Ship Order
            </span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// CANCEL ORDER MODAL
// ═══════════════════════════════════════════════════════════════

function CancelOrderModal({ order, isProcessing, onCancel, onClose }) {
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
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: 60,
            height: 60,
            background: 'var(--danger-light)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <i className="fas fa-times" style={{ fontSize: 24, color: 'var(--danger)' }}></i>
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>Cancel Order?</h3>
          <p style={{ color: 'var(--gray)', fontSize: 14 }}>
            This action cannot be undone.
          </p>
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Reason for cancellation</label>
          <select
            className="form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ paddingLeft: 16 }}
          >
            <option value="">Select reason</option>
            {reasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            Go Back
          </button>
          <button
            className={`btn ${isProcessing ? 'loading' : ''}`}
            onClick={() => onCancel(reason)}
            disabled={isProcessing || !reason}
            style={{
              flex: 1,
              background: 'var(--danger)',
              color: 'white',
            }}
          >
            <span className="btn-text">Cancel Order</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default Orders;
