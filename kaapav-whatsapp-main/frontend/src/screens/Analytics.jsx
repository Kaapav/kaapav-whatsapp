/**
 * ════════════════════════════════════════════════════════════════
 * ANALYTICS SCREEN
 * Business insights and charts
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiTrendingUp, FiTrendingDown, FiDollarSign, 
  FiShoppingBag, FiUsers, FiMessageCircle
} from 'react-icons/fi';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import api from '../api';
import PullToRefresh from '../components/PullToRefresh';

// ═══════════════════════════════════════════════════════════════
// PERIOD SELECTOR
// ═══════════════════════════════════════════════════════════════

const PERIODS = [
  { id: '7', label: '7D' },
  { id: '30', label: '30D' },
  { id: '90', label: '90D' },
];

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, change, color }) {
  const isPositive = change >= 0;
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ANALYTICS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Analytics() {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const loadAnalytics = async () => {
    try {
      const [revenue, customers, products] = await Promise.all([
        api.stats.getAnalytics('revenue', period),
        api.stats.getAnalytics('customers', period),
        api.stats.getAnalytics('products', period),
      ]);
      
      setData({ revenue, customers, products });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    setIsLoading(true);
    loadAnalytics();
  }, [period]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalytics();
  };
  
  // Chart colors
  const COLORS = ['#DBAC35', '#22C55E', '#3B82F6', '#EF4444', '#A855F7'];
  
  // Calculate totals from data
  const totalRevenue = data?.revenue?.daily?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0;
  const totalOrders = data?.revenue?.daily?.reduce((sum, d) => sum + (d.orders || 0), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  
  return (
    <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      <div className="min-h-screen bg-dark safe-top">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-sm text-gray-400">Business insights</p>
            </div>
            
            {/* Period Selector */}
            <div className="flex bg-dark-200 rounded-xl p-1">
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p.id
                      ? 'bg-primary text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-4 pb-20 space-y-6">
          {isLoading ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-28 skeleton rounded-2xl" />
                ))}
              </div>
              <div className="h-64 skeleton rounded-2xl" />
              <div className="h-64 skeleton rounded-2xl" />
            </>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={FiDollarSign}
                  label="Revenue"
                  value={`₹${totalRevenue.toLocaleString()}`}
                  change={12}
                  color="bg-green-500/20 text-green-500"
                />
                <StatCard
                  icon={FiShoppingBag}
                  label="Orders"
                  value={totalOrders}
                  change={8}
                  color="bg-blue-500/20 text-blue-500"
                />
                <StatCard
                  icon={FiUsers}
                  label="New Customers"
                  value={data?.customers?.growth?.reduce((sum, d) => sum + d.new_customers, 0) || 0}
                  change={15}
                  color="bg-purple-500/20 text-purple-500"
                />
                <StatCard
                  icon={FiTrendingUp}
                  label="Avg Order Value"
                  value={`₹${avgOrderValue}`}
                  color="bg-primary/20 text-primary"
                />
              </div>
              
              {/* Revenue Chart */}
              <div className="card">
                <h3 className="font-semibold text-white mb-4">Revenue Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.revenue?.daily || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DBAC35" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#DBAC35" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666"
                        tick={{ fill: '#666', fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      />
                      <YAxis 
                        stroke="#666"
                        tick={{ fill: '#666', fontSize: 12 }}
                        tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #2a2a2a',
                          borderRadius: '12px'
                        }}
                        formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#DBAC35" 
                        fill="url(#colorRevenue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Orders Chart */}
              <div className="card">
                <h3 className="font-semibold text-white mb-4">Daily Orders</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.revenue?.daily || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666"
                        tick={{ fill: '#666', fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric' })}
                      />
                      <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #2a2a2a',
                          borderRadius: '12px'
                        }}
                      />
                      <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Customer Segments */}
              {data?.customers?.bySegment && (
                <div className="card">
                  <h3 className="font-semibold text-white mb-4">Customer Segments</h3>
                  <div className="h-48 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.customers.bySegment}
                          dataKey="count"
                          nameKey="segment"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ segment, count }) => `${segment}: ${count}`}
                        >
                          {data.customers.bySegment.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: '#1a1a1a', 
                            border: '1px solid #2a2a2a',
                            borderRadius: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              
              {/* Top Products */}
              {data?.products?.bestSellers && (
                <div className="card">
                  <h3 className="font-semibold text-white mb-4">Top Products</h3>
                  <div className="space-y-3">
                    {data.products.bestSellers.slice(0, 5).map((product, i) => (
                      <div key={product.sku} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{product.name}</p>
                          <p className="text-sm text-gray-400">₹{product.price}</p>
                        </div>
                        <p className="text-primary font-medium">{product.order_count} sold</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}