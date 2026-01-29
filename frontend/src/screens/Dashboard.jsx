/**
 * ════════════════════════════════════════════════════════════════
 * DASHBOARD SCREEN
 * Overview with stats, recent orders, and quick actions
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiMessageCircle, FiShoppingBag, FiDollarSign, FiUsers,
  FiTrendingUp, FiPackage, FiAlertCircle, FiChevronRight,
  FiRefreshCw
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../api';
import PullToRefresh from '../components/PullToRefresh';

// ═══════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, subValue, color, onClick }) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} />
        </div>
        {subValue && (
          <span className="text-xs text-gray-400">{subValue}</span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RECENT ORDER ITEM
// ═══════════════════════════════════════════════════════════════

function RecentOrderItem({ order, onClick }) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-500',
    confirmed: 'bg-blue-500/20 text-blue-500',
    shipped: 'bg-primary/20 text-primary',
    delivered: 'bg-green-500/20 text-green-500',
    cancelled: 'bg-red-500/20 text-red-500',
  };
  
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center justify-between py-3 border-b border-dark-200 last:border-0 cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white truncate">{order.order_id}</p>
          <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[order.status]}`}>
            {order.status}
          </span>
        </div>
        <p className="text-sm text-gray-400 truncate">
          {order.customer_name || order.phone}
        </p>
      </div>
      <div className="text-right ml-4">
        <p className="font-semibold text-primary">₹{order.total}</p>
        <p className="text-xs text-gray-500">
          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUICK ACTION BUTTON
// ═══════════════════════════════════════════════════════════════

function QuickAction({ icon: Icon, label, onClick, badge }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-dark-100 rounded-2xl border border-dark-200 hover:border-dark-300 transition-colors relative"
    >
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full text-xs flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <Icon size={24} className="text-primary" />
      <span className="text-xs text-gray-400">{label}</span>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fetchStats = async () => {
    try {
      const data = await api.stats.getDashboard();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 skeleton" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 skeleton rounded-2xl" />
            ))}
          </div>
          <div className="h-64 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }
  
  return (
    <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <div className="min-h-screen bg-dark safe-top">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-gray-400 text-sm">Welcome back! 👋</p>
            </div>
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-xl bg-dark-100 ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <FiRefreshCw size={20} className="text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={FiMessageCircle}
              label="Unread Chats"
              value={stats?.chats?.unread || 0}
              subValue={`${stats?.chats?.total || 0} total`}
              color="bg-blue-500/20 text-blue-500"
              onClick={() => navigate('/chats')}
            />
            <StatCard
              icon={FiShoppingBag}
              label="Orders Today"
              value={stats?.orders?.today || 0}
              subValue={`${stats?.orders?.pending || 0} pending`}
              color="bg-purple-500/20 text-purple-500"
              onClick={() => navigate('/orders')}
            />
            <StatCard
              icon={FiDollarSign}
              label="Revenue Today"
              value={`₹${(stats?.revenue?.today || 0).toLocaleString()}`}
              subValue={stats?.revenue?.avgOrderValue ? `Avg ₹${stats.revenue.avgOrderValue}` : ''}
              color="bg-green-500/20 text-green-500"
              onClick={() => navigate('/analytics')}
            />
            <StatCard
              icon={FiUsers}
              label="New Customers"
              value={stats?.customers?.newToday || 0}
              subValue={`${stats?.customers?.total || 0} total`}
              color="bg-primary/20 text-primary"
              onClick={() => navigate('/customers')}
            />
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="px-4 py-4">
          <h2 className="text-lg font-semibold text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-3">
            <QuickAction
              icon={FiMessageCircle}
              label="Chats"
              badge={stats?.chats?.unread}
              onClick={() => navigate('/chats')}
            />
            <QuickAction
              icon={FiPackage}
              label="Orders"
              badge={stats?.orders?.pending}
              onClick={() => navigate('/orders')}
            />
            <QuickAction
              icon={FiAlertCircle}
              label="Low Stock"
              badge={stats?.products?.lowStock}
              onClick={() => navigate('/products?filter=low_stock')}
            />
            <QuickAction
              icon={FiTrendingUp}
              label="Analytics"
              onClick={() => navigate('/analytics')}
            />
          </div>
        </div>
        
        {/* Recent Orders */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-primary text-sm flex items-center gap-1"
            >
              View All <FiChevronRight size={16} />
            </button>
          </div>
          
          <div className="card">
            {stats?.recentOrders?.length > 0 ? (
              stats.recentOrders.map(order => (
                <RecentOrderItem
                  key={order.order_id}
                  order={order}
                  onClick={() => navigate(`/orders?id=${order.order_id}`)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiShoppingBag size={32} className="mx-auto mb-2 opacity-50" />
                <p>No orders yet</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Unread Messages */}
        {stats?.recentMessages?.length > 0 && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Unread Messages</h2>
              <button
                onClick={() => navigate('/chats')}
                className="text-primary text-sm flex items-center gap-1"
              >
                View All <FiChevronRight size={16} />
              </button>
            </div>
            
            <div className="space-y-2">
              {stats.recentMessages.slice(0, 3).map((chat, i) => (
                <motion.div
                  key={chat.phone}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => navigate(`/chats/${chat.phone}`)}
                  className="card-hover flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-black font-semibold">
                    {chat.customer_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {chat.customer_name || chat.phone}
                    </p>
                    <p className="text-sm text-gray-400 truncate">{chat.last_message}</p>
                  </div>
                  {chat.unread_count > 0 && (
                    <span className="w-6 h-6 bg-primary rounded-full text-black text-xs font-medium flex items-center justify-center">
                      {chat.unread_count}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
        
        {/* Bottom spacing for nav */}
        <div className="h-4" />
      </div>
    </PullToRefresh>
  );
}