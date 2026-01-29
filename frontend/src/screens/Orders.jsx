/**
 * ════════════════════════════════════════════════════════════════
 * ORDERS SCREEN
 * Order management with filters and actions
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, FiFilter, FiPackage, FiTruck, FiCheck,
  FiX, FiClock, FiDollarSign, FiChevronRight
} from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { useOrderStore } from '../store';
import api from '../api';
import PullToRefresh from '../components/PullToRefresh';
import OrderCard from '../components/OrderCard';

// ═══════════════════════════════════════════════════════════════
// FILTER TABS
// ═══════════════════════════════════════════════════════════════

const STATUS_FILTERS = [
  { id: 'all', label: 'All', icon: FiPackage },
  { id: 'pending', label: 'Pending', icon: FiClock },
  { id: 'confirmed', label: 'Confirmed', icon: FiCheck },
  { id: 'shipped', label: 'Shipped', icon: FiTruck },
  { id: 'delivered', label: 'Delivered', icon: FiCheck },
  { id: 'cancelled', label: 'Cancelled', icon: FiX },
];

// ═══════════════════════════════════════════════════════════════
// ORDER DETAIL MODAL
// ═══════════════════════════════════════════════════════════════

function OrderDetailModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const data = await api.orders.getOne(orderId);
        setOrder(data.order);
      } catch (error) {
        toast.error('Failed to load order');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOrder();
  }, [orderId]);
  
  const handleAction = async (action) => {
    setIsProcessing(true);
    try {
      switch (action) {
        case 'confirm':
          await api.orders.confirm(orderId);
          toast.success('Order confirmed');
          break;
        case 'ship':
          await api.orders.ship(orderId, {});
          toast.success('Order shipped');
          break;
        case 'cancel':
          await api.orders.cancel(orderId, 'Cancelled by admin');
          toast.success('Order cancelled');
          break;
        case 'payment_link':
          const result = await api.orders.generatePaymentLink(orderId);
          navigator.clipboard.writeText(result.paymentLink);
          toast.success('Payment link copied!');
          break;
      }
      
      // Reload order
      const data = await api.orders.getOne(orderId);
      setOrder(data.order);
    } catch (error) {
      toast.error(error.message || 'Action failed');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const statusConfig = {
    pending: { color: 'bg-yellow-500/20 text-yellow-500', label: 'Pending' },
    confirmed: { color: 'bg-blue-500/20 text-blue-500', label: 'Confirmed' },
    processing: { color: 'bg-blue-500/20 text-blue-500', label: 'Processing' },
    shipped: { color: 'bg-primary/20 text-primary', label: 'Shipped' },
    delivered: { color: 'bg-green-500/20 text-green-500', label: 'Delivered' },
    cancelled: { color: 'bg-red-500/20 text-red-500', label: 'Cancelled' },
  };
  
  const paymentConfig = {
    paid: { color: 'bg-green-500/20 text-green-500', label: 'Paid' },
    unpaid: { color: 'bg-red-500/20 text-red-500', label: 'Unpaid' },
    pending: { color: 'bg-yellow-500/20 text-yellow-500', label: 'Pending' },
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-dark-100 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-100 border-b border-dark-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Order Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-200 rounded-full">
            <FiX size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 skeleton rounded-xl" />
              ))}
            </div>
          ) : order ? (
            <div className="space-y-4">
              {/* Order ID & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-white">{order.orderId}</p>
                  <p className="text-sm text-gray-400">
                    {format(new Date(order.timestamps?.created), 'PPp')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-3 py-1 rounded-full text-sm ${statusConfig[order.status]?.color}`}>
                    {statusConfig[order.status]?.label}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm ${paymentConfig[order.paymentStatus]?.color}`}>
                    {paymentConfig[order.paymentStatus]?.label}
                  </span>
                </div>
              </div>
              
              {/* Customer */}
              <div className="bg-dark-200 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">Customer</p>
                <p className="font-medium text-white">{order.customerName || 'Unknown'}</p>
                <p className="text-sm text-gray-400">{order.phone}</p>
              </div>
              
              {/* Items */}
              <div className="bg-dark-200 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-2">Items ({order.itemCount})</p>
                {order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-dark-300 last:border-0">
                    <div>
                      <p className="text-white">{item.name}</p>
                      <p className="text-sm text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-primary font-medium">₹{item.price * item.quantity}</p>
                  </div>
                ))}
              </div>
              
              {/* Pricing */}
              <div className="bg-dark-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">₹{order.subtotal}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Discount</span>
                    <span className="text-green-500">-₹{order.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Shipping</span>
                  <span className="text-white">
                    {order.shippingCost > 0 ? `₹${order.shippingCost}` : 'FREE'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-dark-300">
                  <span className="font-medium text-white">Total</span>
                  <span className="font-bold text-primary text-lg">₹{order.total}</span>
                </div>
              </div>
              
              {/* Shipping Address */}
              <div className="bg-dark-200 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-1">Shipping Address</p>
                <p className="text-white">{order.shipping?.name}</p>
                <p className="text-sm text-gray-400">
                  {order.shipping?.address}<br />
                  {order.shipping?.city}, {order.shipping?.state} - {order.shipping?.pincode}
                </p>
              </div>
              
              {/* Tracking */}
              {order.tracking?.trackingId && (
                <div className="bg-dark-200 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Tracking</p>
                  <p className="text-white">{order.tracking.courier}</p>
                  <p className="text-primary">{order.tracking.trackingId}</p>
                </div>
              )}
              
              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {order.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleAction('confirm')}
                      disabled={isProcessing}
                      className="btn-success py-3"
                    >
                      <FiCheck /> Confirm
                    </button>
                    <button 
                      onClick={() => handleAction('cancel')}
                      disabled={isProcessing}
                      className="btn-danger py-3"
                    >
                      <FiX /> Cancel
                    </button>
                  </>
                )}
                {order.status === 'confirmed' && (
                  <button 
                    onClick={() => handleAction('ship')}
                    disabled={isProcessing}
                    className="btn-primary py-3 col-span-2"
                  >
                    <FiTruck /> Mark Shipped
                  </button>
                )}
                {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleAction('payment_link')}
                    disabled={isProcessing}
                    className="btn-secondary py-3 col-span-2"
                  >
                    <FiDollarSign /> Copy Payment Link
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500">Order not found</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORDERS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { orders, stats, total, isLoading, fetchOrders, fetchStats } = useOrderStore();
  
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState(searchParams.get('status') || 'all');
  const [selectedOrderId, setSelectedOrderId] = useState(searchParams.get('id') || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const loadOrders = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    if (activeStatus !== 'all') params.status = activeStatus;
    
    await fetchOrders(params);
    await fetchStats();
  }, [search, activeStatus, fetchOrders, fetchStats]);
  
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders();
    setIsRefreshing(false);
  };
  
  const handleStatusChange = (status) => {
    setActiveStatus(status);
    setSearchParams(status !== 'all' ? { status } : {});
  };
  
  return (
    <>
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="min-h-screen bg-dark safe-top">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">Orders</h1>
                  <p className="text-sm text-gray-400">
                    {stats?.stats?.totalOrders || 0} orders • ₹{(stats?.stats?.totalRevenue || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="input pl-11 bg-dark-100"
                />
              </div>
            </div>
            
            {/* Status Tabs */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto hide-scrollbar">
              {STATUS_FILTERS.map(filter => {
                const count = filter.id === 'all' 
                  ? total 
                  : stats?.stats?.byStatus?.[filter.id] || 0;
                
                return (
                  <button
                    key={filter.id}
                    onClick={() => handleStatusChange(filter.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                      activeStatus === filter.id
                        ? 'bg-primary text-black'
                        : 'bg-dark-200 text-gray-400 hover:bg-dark-300'
                    }`}
                  >
                    <filter.icon size={16} />
                    {filter.label}
                    {count > 0 && (
                      <span className={`text-xs ${activeStatus === filter.id ? 'text-black/60' : 'text-gray-500'}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Order List */}
          <div className="p-4 pb-20 space-y-3">
            {isLoading && !orders.length ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-32 skeleton rounded-2xl" />
              ))
            ) : orders.length > 0 ? (
              orders.map(order => (
                <OrderCard
                  key={order.orderId}
                  order={order}
                  onClick={() => setSelectedOrderId(order.orderId)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <FiPackage size={48} className="mb-4 opacity-50" />
                <p className="text-lg">No orders found</p>
                <p className="text-sm">
                  {search ? 'Try a different search' : 'Orders will appear here'}
                </p>
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
      
      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrderId && (
          <OrderDetailModal
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}