/**
 * ════════════════════════════════════════════════════════════════
 * CUSTOMERS SCREEN
 * Customer list and management
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiSearch, FiUsers, FiStar, FiShoppingBag,
  FiMessageCircle, FiChevronRight
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import api from '../api';
import PullToRefresh from '../components/PullToRefresh';

// ═══════════════════════════════════════════════════════════════
// SEGMENT TABS
// ═══════════════════════════════════════════════════════════════

const SEGMENTS = [
  { id: 'all', label: 'All' },
  { id: 'vip', label: 'VIP' },
  { id: 'loyal', label: 'Loyal' },
  { id: 'returning', label: 'Returning' },
  { id: 'new', label: 'New' },
];

// ═══════════════════════════════════════════════════════════════
// CUSTOMER CARD
// ═══════════════════════════════════════════════════════════════

function CustomerCard({ customer, onClick }) {
  const tierColors = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-400 to-cyan-600',
    diamond: 'from-purple-400 to-pink-500',
  };
  
  const segmentColors = {
    vip: 'bg-purple-500/20 text-purple-400',
    loyal: 'bg-blue-500/20 text-blue-400',
    returning: 'bg-green-500/20 text-green-400',
    first_order: 'bg-yellow-500/20 text-yellow-400',
    new: 'bg-gray-500/20 text-gray-400',
  };
  
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-hover flex items-center gap-4"
    >
      {/* Avatar */}
      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${tierColors[customer.tier] || 'from-dark-300 to-dark-400'} flex items-center justify-center text-white font-semibold text-lg`}>
        {customer.name?.[0]?.toUpperCase() || '?'}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-white truncate">
            {customer.name || customer.phone}
          </h3>
          {customer.segment && (
            <span className={`px-2 py-0.5 rounded-full text-xs ${segmentColors[customer.segment]}`}>
              {customer.segment}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">{customer.phone}</p>
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FiShoppingBag size={12} />
            {customer.order_count} orders
          </span>
          <span>₹{(customer.total_spent || 0).toLocaleString()}</span>
        </div>
      </div>
      
      <FiChevronRight className="text-gray-500" />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CUSTOMERS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Customers() {
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSegment, setActiveSegment] = useState('all');
  
  const loadCustomers = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (activeSegment !== 'all') params.segment = activeSegment;
      
      const data = await api.customers.getAll(params);
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, activeSegment]);
  
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCustomers();
  };
  
  return (
    <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <div className="min-h-screen bg-dark safe-top">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Customers</h1>
                <p className="text-sm text-gray-400">{customers.length} customers</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="input pl-11 bg-dark-100"
              />
            </div>
          </div>
          
          {/* Segment Tabs */}
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto hide-scrollbar">
            {SEGMENTS.map(segment => (
              <button
                key={segment.id}
                onClick={() => setActiveSegment(segment.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  activeSegment === segment.id
                    ? 'bg-primary text-black'
                    : 'bg-dark-200 text-gray-400'
                }`}
              >
                {segment.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Customer List */}
        <div className="p-4 pb-20 space-y-3">
          {isLoading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 skeleton rounded-2xl" />
            ))
          ) : customers.length > 0 ? (
            customers.map(customer => (
              <CustomerCard
                key={customer.phone}
                customer={customer}
                onClick={() => navigate(`/chats/${customer.phone}`)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <FiUsers size={48} className="mb-4 opacity-50" />
              <p className="text-lg">No customers found</p>
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}