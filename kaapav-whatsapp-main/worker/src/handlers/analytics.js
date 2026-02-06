/**
 * ════════════════════════════════════════════════════════════════
 * ANALYTICS HANDLER
 * Dashboard stats and reporting
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleAnalytics(request, ctx, action) {
  const { env, url } = ctx;
  
  try {
    if (action === 'stats') {
      return getDashboardStats(ctx);
    }
    
    if (action === 'analytics') {
      const type = url.searchParams.get('type');
      
      switch (type) {
        case 'revenue':
          return getRevenueAnalytics(ctx);
        case 'customers':
          return getCustomerAnalytics(ctx);
        case 'products':
          return getProductAnalytics(ctx);
        case 'messages':
          return getMessageAnalytics(ctx);
        case 'campaigns':
          return getCampaignAnalytics(ctx);
        default:
          return getDashboardStats(ctx);
      }
    }
    
    return errorResponse('Invalid analytics type', 400);
  } catch (error) {
    console.error('[Analytics] Error:', error.message);
    return errorResponse('Failed to fetch analytics', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═════════════════════════════════════════════════════════════════

async function getDashboardStats(ctx) {
  const { env } = ctx;
  
  // Today's date filters
  const today = `date('now')`;
  const thisWeek = `datetime('now', '-7 days')`;
  const thisMonth = `datetime('now', '-30 days')`;
  
  // Run all queries in parallel
  const [
    orderStats,
    chatStats,
    customerStats,
    productStats,
    recentOrders,
    topProducts,
    recentMessages
  ] = await Promise.all([
    // Order stats
    env.DB.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total) as total_revenue,
        SUM(CASE WHEN date(created_at) = ${today} THEN 1 ELSE 0 END) as orders_today,
        SUM(CASE WHEN date(created_at) = ${today} THEN total ELSE 0 END) as revenue_today,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN payment_status = 'unpaid' AND status != 'cancelled' THEN 1 ELSE 0 END) as unpaid_orders,
        AVG(total) as avg_order_value
      FROM orders
    `).first(),
    
    // Chat stats
    env.DB.prepare(`
      SELECT
        COUNT(*) as total_chats,
        SUM(unread_count) as unread_messages,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_chats,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_chats,
        SUM(CASE WHEN updated_at >= ${thisWeek} THEN 1 ELSE 0 END) as active_chats
      FROM chats
    `).first(),
    
    // Customer stats
    env.DB.prepare(`
      SELECT
        COUNT(*) as total_customers,
        SUM(CASE WHEN first_seen >= ${today} THEN 1 ELSE 0 END) as new_today,
        SUM(CASE WHEN first_seen >= ${thisWeek} THEN 1 ELSE 0 END) as new_this_week,
        SUM(CASE WHEN segment = 'vip' THEN 1 ELSE 0 END) as vip_customers,
        SUM(CASE WHEN order_count > 0 THEN 1 ELSE 0 END) as paying_customers
      FROM customers WHERE opted_in = 1
    `).first(),
    
    // Product stats
    env.DB.prepare(`
      SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN stock = 0 AND track_inventory = 1 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN stock <= 10 AND stock > 0 AND track_inventory = 1 THEN 1 ELSE 0 END) as low_stock
      FROM products WHERE is_active = 1
    `).first(),
    
    // Recent orders
    env.DB.prepare(`
      SELECT order_id, phone, customer_name, total, status, payment_status, created_at
      FROM orders ORDER BY created_at DESC LIMIT 5
    `).all(),
    
    // Top products
    env.DB.prepare(`
      SELECT sku, name, price, stock, order_count, image_url
      FROM products WHERE is_active = 1 ORDER BY order_count DESC LIMIT 5
    `).all(),
    
    // Recent unread messages
    env.DB.prepare(`
      SELECT c.phone, c.customer_name, c.last_message, c.unread_count, c.last_timestamp
      FROM chats c WHERE c.unread_count > 0
      ORDER BY c.last_timestamp DESC LIMIT 5
    `).all(),
  ]);
  
  return jsonResponse({
    orders: {
      total: orderStats?.total_orders || 0,
      today: orderStats?.orders_today || 0,
      pending: orderStats?.pending_orders || 0,
      confirmed: orderStats?.confirmed_orders || 0,
      shipped: orderStats?.shipped_orders || 0,
      delivered: orderStats?.delivered_orders || 0,
      unpaid: orderStats?.unpaid_orders || 0,
    },
    revenue: {
      total: orderStats?.total_revenue || 0,
      today: orderStats?.revenue_today || 0,
      avgOrderValue: Math.round(orderStats?.avg_order_value || 0),
    },
    chats: {
      total: chatStats?.total_chats || 0,
      unread: chatStats?.unread_messages || 0,
      open: chatStats?.open_chats || 0,
      pending: chatStats?.pending_chats || 0,
      active: chatStats?.active_chats || 0,
    },
    customers: {
      total: customerStats?.total_customers || 0,
      newToday: customerStats?.new_today || 0,
      newThisWeek: customerStats?.new_this_week || 0,
      vip: customerStats?.vip_customers || 0,
      paying: customerStats?.paying_customers || 0,
    },
    products: {
      total: productStats?.total_products || 0,
      inStock: productStats?.in_stock || 0,
      outOfStock: productStats?.out_of_stock || 0,
      lowStock: productStats?.low_stock || 0,
    },
    recentOrders: recentOrders?.results || [],
    topProducts: topProducts?.results || [],
    recentMessages: recentMessages?.results || [],
  });
}

// ═════════════════════════════════════════════════════════════════
// REVENUE ANALYTICS
// ═════════════════════════════════════════════════════════════════

async function getRevenueAnalytics(ctx) {
  const { env, url } = ctx;
  
  const period = url.searchParams.get('period') || '30';
  const days = parseInt(period);
  
  // Daily revenue
  const { results: daily } = await env.DB.prepare(`
    SELECT 
      date(created_at) as date,
      COUNT(*) as orders,
      SUM(total) as revenue,
      AVG(total) as avg_value
    FROM orders
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    AND status != 'cancelled'
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).bind(days).all();
  
  // Revenue by payment method
  const { results: byPayment } = await env.DB.prepare(`
    SELECT 
      payment_method,
      COUNT(*) as orders,
      SUM(total) as revenue
    FROM orders
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    AND status != 'cancelled'
    GROUP BY payment_method
  `).bind(days).all();
  
  // Revenue by status
  const { results: byStatus } = await env.DB.prepare(`
    SELECT 
      status,
      COUNT(*) as orders,
      SUM(total) as revenue
    FROM orders
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY status
  `).bind(days).all();
  
  // Top customers by revenue
  const { results: topCustomers } = await env.DB.prepare(`
    SELECT 
      o.phone,
      c.name,
      COUNT(*) as orders,
      SUM(o.total) as revenue
    FROM orders o
    LEFT JOIN customers c ON o.phone = c.phone
    WHERE o.created_at >= datetime('now', '-' || ? || ' days')
    AND o.status != 'cancelled'
    GROUP BY o.phone
    ORDER BY revenue DESC
    LIMIT 10
  `).bind(days).all();
  
  return jsonResponse({
    daily,
    byPaymentMethod: byPayment,
    byStatus,
    topCustomers,
  });
}

// ═════════════════════════════════════════════════════════════════
// CUSTOMER ANALYTICS
// ═════════════════════════════════════════════════════════════════

async function getCustomerAnalytics(ctx) {
  const { env, url } = ctx;
  
  const period = url.searchParams.get('period') || '30';
  const days = parseInt(period);
  
  // New customers over time
  const { results: growth } = await env.DB.prepare(`
    SELECT 
      date(first_seen) as date,
      COUNT(*) as new_customers
    FROM customers
    WHERE first_seen >= datetime('now', '-' || ? || ' days')
    GROUP BY date(first_seen)
    ORDER BY date ASC
  `).bind(days).all();
  
  // Segment distribution
  const { results: bySegment } = await env.DB.prepare(`
    SELECT 
      segment,
      COUNT(*) as count,
      SUM(total_spent) as total_spent,
      AVG(order_count) as avg_orders
    FROM customers
    WHERE opted_in = 1
    GROUP BY segment
  `).all();
  
  // Tier distribution
  const { results: byTier } = await env.DB.prepare(`
    SELECT 
      tier,
      COUNT(*) as count,
      SUM(total_spent) as total_spent
    FROM customers
    WHERE opted_in = 1
    GROUP BY tier
  `).all();
  
  // Customer retention (ordered more than once)
  const retention = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) as returning
    FROM customers
    WHERE order_count > 0
  `).first();
  
  const retentionRate = retention?.total > 0 
    ? Math.round((retention.returning / retention.total) * 100) 
    : 0;
  
  return jsonResponse({
    growth,
    bySegment,
    byTier,
    retention: {
      total: retention?.total || 0,
      returning: retention?.returning || 0,
      rate: retentionRate,
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// PRODUCT ANALYTICS
// ═════════════════════════════════════════════════════════════════

async function getProductAnalytics(ctx) {
  const { env, url } = ctx;
  
  const period = url.searchParams.get('period') || '30';
  const days = parseInt(period);
  
  // Best sellers
  const { results: bestSellers } = await env.DB.prepare(`
    SELECT 
      p.sku,
      p.name,
      p.price,
      p.image_url,
      p.order_count,
      p.stock
    FROM products p
    WHERE p.is_active = 1
    ORDER BY p.order_count DESC
    LIMIT 10
  `).all();
  
  // Category performance
  const { results: byCategory } = await env.DB.prepare(`
    SELECT 
      category,
      COUNT(*) as product_count,
      SUM(order_count) as total_orders,
      SUM(stock) as total_stock
    FROM products
    WHERE is_active = 1
    GROUP BY category
    ORDER BY total_orders DESC
  `).all();
  
  // Low stock alerts
  const { results: lowStock } = await env.DB.prepare(`
    SELECT sku, name, stock, image_url
    FROM products
    WHERE is_active = 1 AND track_inventory = 1 AND stock <= 10
    ORDER BY stock ASC
    LIMIT 20
  `).all();
  
  // Out of stock
  const { results: outOfStock } = await env.DB.prepare(`
    SELECT sku, name, image_url
    FROM products
    WHERE is_active = 1 AND track_inventory = 1 AND stock = 0
  `).all();
  
  return jsonResponse({
    bestSellers,
    byCategory,
    lowStock,
    outOfStock,
  });
}

// ═════════════════════════════════════════════════════════════════
// MESSAGE ANALYTICS
// ═════════════════════════════════════════════════════════════════

async function getMessageAnalytics(ctx) {
  const { env, url } = ctx;
  
  const period = url.searchParams.get('period') || '7';
  const days = parseInt(period);
  
  // Message volume over time
  const { results: volume } = await env.DB.prepare(`
    SELECT 
      date(timestamp) as date,
      SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
      SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing
    FROM messages
    WHERE timestamp >= datetime('now', '-' || ? || ' days')
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).bind(days).all();
  
  // Message types
  const { results: byType } = await env.DB.prepare(`
    SELECT 
      message_type,
      COUNT(*) as count
    FROM messages
    WHERE timestamp >= datetime('now', '-' || ? || ' days')
    GROUP BY message_type
    ORDER BY count DESC
  `).bind(days).all();
  
  // Response time (average time to first response)
  // This is a simplified version
  const responseStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_conversations,
      AVG(CASE WHEN is_auto_reply = 1 THEN 1 ELSE 0 END) as auto_reply_rate
    FROM messages
    WHERE direction = 'outgoing'
    AND timestamp >= datetime('now', '-' || ? || ' days')
  `).bind(days).first();
  
  // Quick reply usage
  const { results: quickReplyUsage } = await env.DB.prepare(`
    SELECT 
      shortcut,
      title,
      use_count
    FROM quick_replies
    WHERE is_active = 1
    ORDER BY use_count DESC
    LIMIT 10
  `).all();
  
  return jsonResponse({
    volume,
    byType,
    responseStats: {
      autoReplyRate: Math.round((responseStats?.auto_reply_rate || 0) * 100),
    },
    quickReplyUsage,
  });
}

// ═════════════════════════════════════════════════════════════════
// CAMPAIGN ANALYTICS
// ═════════════════════════════════════════════════════════════════

async function getCampaignAnalytics(ctx) {
  const { env } = ctx;
  
  // Recent campaigns
  const { results: campaigns } = await env.DB.prepare(`
    SELECT 
      broadcast_id,
      name,
      message_type,
      target_count,
      sent_count,
      delivered_count,
      read_count,
      failed_count,
      status,
      created_at,
      completed_at
    FROM broadcasts
    ORDER BY created_at DESC
    LIMIT 20
  `).all();
  
  // Calculate rates
  const enrichedCampaigns = campaigns.map(c => ({
    ...c,
    deliveryRate: c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0,
    readRate: c.delivered_count > 0 ? Math.round((c.read_count / c.delivered_count) * 100) : 0,
  }));
  
  // Overall stats
  const overallStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_campaigns,
      SUM(target_count) as total_recipients,
      SUM(sent_count) as total_sent,
      SUM(delivered_count) as total_delivered,
      SUM(read_count) as total_read
    FROM broadcasts
    WHERE status = 'completed'
  `).first();
  
  return jsonResponse({
    campaigns: enrichedCampaigns,
    overall: {
      totalCampaigns: overallStats?.total_campaigns || 0,
      totalRecipients: overallStats?.total_recipients || 0,
      totalSent: overallStats?.total_sent || 0,
      avgDeliveryRate: overallStats?.total_sent > 0 
        ? Math.round((overallStats.total_delivered / overallStats.total_sent) * 100) 
        : 0,
      avgReadRate: overallStats?.total_delivered > 0 
        ? Math.round((overallStats.total_read / overallStats.total_delivered) * 100) 
        : 0,
    },
  });
}