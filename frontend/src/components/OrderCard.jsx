/**
 * ════════════════════════════════════════════════════════════════
 * ORDER CARD
 * Order summary card for list view
 * ════════════════════════════════════════════════════════════════
 */

import { motion } from 'framer-motion';
import { 
  FiPackage, FiTruck, FiCheck, FiX, FiClock,
  FiDollarSign, FiUser, FiMapPin
} from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';

export default function OrderCard({ order, onClick }) {
  // Status configuration
  const statusConfig = {
    pending: { 
      color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      icon: FiClock,
      label: 'Pending'
    },
    confirmed: { 
      color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      icon: FiCheck,
      label: 'Confirmed'
    },
    processing: { 
      color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      icon: FiPackage,
      label: 'Processing'
    },
    shipped: { 
      color: 'bg-primary/20 text-primary border-primary/30',
      icon: FiTruck,
      label: 'Shipped'
    },
    delivered: { 
      color: 'bg-green-500/20 text-green-500 border-green-500/30',
      icon: FiCheck,
      label: 'Delivered'
    },
    cancelled: { 
      color: 'bg-red-500/20 text-red-500 border-red-500/30',
      icon: FiX,
      label: 'Cancelled'
    },
  };
  
  const paymentConfig = {
    paid: { color: 'text-green-500', icon: FiCheck, label: 'Paid' },
    unpaid: { color: 'text-red-500', icon: FiX, label: 'Unpaid' },
    pending: { color: 'text-yellow-500', icon: FiClock, label: 'Pending' },
    refunded: { color: 'text-gray-500', icon: FiDollarSign, label: 'Refunded' },
  };
  
  const status = statusConfig[order.status] || statusConfig.pending;
  const payment = paymentConfig[order.paymentStatus] || paymentConfig.unpaid;
  const StatusIcon = status.icon;
  const PaymentIcon = payment.icon;
  
  // Parse items
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const itemCount = items?.reduce((sum, i) => sum + i.quantity, 0) || order.itemCount || 0;
  
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`card cursor-pointer border-l-4 ${status.color.split(' ')[0].replace('bg-', 'border-').replace('/20', '')}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white">{order.orderId}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${status.color}`}>
              <StatusIcon size={12} />
              {status.label}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {order.timestamps?.created 
              ? format(new Date(order.timestamps.created), 'MMM d, h:mm a')
              : formatDistanceToNow(new Date(order.createdAt || order.created_at), { addSuffix: true })}
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-xl font-bold text-primary">₹{order.total}</p>
          <div className={`flex items-center gap-1 text-xs ${payment.color}`}>
            <PaymentIcon size={12} />
            {payment.label}
          </div>
        </div>
      </div>
      
      {/* Customer */}
      <div className="flex items-center gap-4 mb-3 py-2 border-y border-dark-200">
        <div className="flex items-center gap-2 flex-1">
          <FiUser size={14} className="text-gray-500" />
          <span className="text-sm text-gray-300 truncate">
            {order.customerName || order.customer_name || order.phone}
          </span>
        </div>
        {(order.shipping?.city || order.shipping_city) && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <FiMapPin size={12} />
            {order.shipping?.city || order.shipping_city}
          </div>
        )}
      </div>
      
      {/* Items Preview */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 truncate">
            {items?.slice(0, 2).map(i => i.name).join(', ') || `${itemCount} items`}
            {items?.length > 2 && ` +${items.length - 2} more`}
          </p>
        </div>
        
        {/* Payment Method Badge */}
        <span className={`px-2 py-0.5 rounded text-xs ${
          order.paymentMethod === 'cod' 
            ? 'bg-gray-500/20 text-gray-400' 
            : 'bg-blue-500/20 text-blue-400'
        }`}>
          {order.paymentMethod === 'cod' ? 'COD' : 'Online'}
        </span>
      </div>
      
      {/* Tracking (if shipped) */}
      {order.status === 'shipped' && order.tracking?.trackingId && (
        <div className="mt-3 pt-3 border-t border-dark-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Tracking:</span>
            <span className="text-primary font-mono">{order.tracking.trackingId}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}