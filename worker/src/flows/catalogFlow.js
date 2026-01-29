/**
 * ════════════════════════════════════════════════════════════════
 * CATALOG FLOW
 * Product browsing and discovery flow
 * ════════════════════════════════════════════════════════════════
 */

import { sendText, sendButtons, sendList, sendImage, sendCatalog, sendProductList } from '../services/whatsapp.js';

// ═════════════════════════════════════════════════════════════════
// MAIN FLOW HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleCatalogFlow(phone, step, input, env) {
  console.log(`[CatalogFlow] ${phone} - Step: ${step}`);
  
  switch (step) {
    case 'start':
      return showCategories(phone, env);
      
    case 'category':
      return showCategory(phone, input.category, env);
      
    case 'product':
      return showProduct(phone, input.sku, env);
      
    case 'search':
      return searchProducts(phone, input.query, env);
      
    default:
      return showCategories(phone, env);
  }
}

// ═════════════════════════════════════════════════════════════════
// SHOW CATEGORIES
// ═════════════════════════════════════════════════════════════════

async function showCategories(phone, env) {
  const { results: categories } = await env.DB.prepare(`
    SELECT category, COUNT(*) as count
    FROM products
    WHERE is_active = 1 AND stock > 0
    GROUP BY category
    ORDER BY count DESC
  `).all();
  
  if (!categories?.length) {
    await sendText(phone, "Our catalog is being updated. Please check back soon! 🛍️", env);
    return;
  }
  
  const message = "🛍️ *KAAPAV Collection*\n\nBrowse our categories:";
  
  // Use emojis for categories
  const categoryEmojis = {
    'Earrings': '👂',
    'Necklaces': '📿',
    'Bracelets': '⌚',
    'Rings': '💍',
    'Anklets': '🦶',
    'Sets': '✨',
    'Hair Accessories': '💇',
  };
  
  const sections = [{
    title: 'Shop by Category',
    rows: categories.slice(0, 10).map(cat => ({
      id: `cat_${cat.category.toLowerCase().replace(/\s+/g, '_')}`,
      title: `${categoryEmojis[cat.category] || '💎'} ${cat.category}`,
      description: `${cat.count} items`,
    })),
  }];
  
  // Add "All Products" option
  sections[0].rows.push({
    id: 'cat_all',
    title: '✨ All Products',
    description: 'View complete collection',
  });
  
  await sendList(phone, message, 'Browse', sections, env);
  
  // Log view
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, created_at)
    VALUES ('catalog', 'view_categories', ?, datetime('now'))
  `).bind(phone).run().catch(() => {});
}

// ═════════════════════════════════════════════════════════════════
// SHOW CATEGORY PRODUCTS
// ═════════════════════════════════════════════════════════════════

async function showCategory(phone, category, env) {
  let query = `
    SELECT * FROM products
    WHERE is_active = 1 AND stock > 0
  `;
  const params = [];
  
  if (category && category !== 'all') {
    query += ` AND LOWER(category) = ?`;
    params.push(category.toLowerCase().replace(/_/g, ' '));
  }
  
  query += ` ORDER BY is_featured DESC, order_count DESC LIMIT 10`;
  
  const { results: products } = await env.DB.prepare(query).bind(...params).all();
  
  if (!products?.length) {
    await sendText(phone, "No products found in this category. Try browsing all products!", env);
    return showCategories(phone, env);
  }
  
  // Build product list message
  const categoryName = category === 'all' ? 'All Products' : category.replace(/_/g, ' ');
  let message = `✨ *${categoryName}*\n\n`;
  
  products.forEach((p, i) => {
    const stockStatus = p.stock <= 5 ? ' ⚡ Few left!' : '';
    const discount = p.compare_price > p.price 
      ? ` ~~₹${p.compare_price}~~` 
      : '';
    
    message += `${i + 1}. *${p.name}*\n`;
    message += `   ₹${p.price}${discount}${stockStatus}\n\n`;
  });
  
  message += `Reply with a number (1-${products.length}) to view details`;
  
  // Create interactive list
  const sections = [{
    title: categoryName,
    rows: products.map(p => ({
      id: `prod_${p.sku}`,
      title: p.name.slice(0, 24),
      description: `₹${p.price} ${p.stock <= 5 ? '• Few left!' : ''}`,
    })),
  }];
  
  await sendList(phone, message, 'View Products', sections, env);
  
  // Log view
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, data, created_at)
    VALUES ('catalog', 'view_category', ?, ?, datetime('now'))
  `).bind(phone, JSON.stringify({ category })).run().catch(() => {});
}

// ═════════════════════════════════════════════════════════════════
// SHOW PRODUCT DETAILS
// ═════════════════════════════════════════════════════════════════

async function showProduct(phone, sku, env) {
  const product = await env.DB.prepare(`
    SELECT * FROM products WHERE sku = ? AND is_active = 1
  `).bind(sku).first();
  
  if (!product) {
    await sendText(phone, "This product is no longer available. Let me show you similar items!", env);
    return showCategories(phone, env);
  }
  
  // Increment view count
  await env.DB.prepare(`
    UPDATE products SET view_count = view_count + 1 WHERE sku = ?
  `).bind(sku).run();
  
  // Send product image
  if (product.image_url) {
    await sendImage(phone, product.image_url, null, env);
  }
  
  // Build product message
  let message = `*${product.name}*\n\n`;
  
  if (product.description) {
    message += `${product.description.slice(0, 500)}\n\n`;
  }
  
  // Price
  if (product.compare_price && product.compare_price > product.price) {
    const discount = Math.round(((product.compare_price - product.price) / product.compare_price) * 100);
    message += `💰 ₹${product.price} ~~₹${product.compare_price}~~ (${discount}% OFF)\n`;
  } else {
    message += `💰 ₹${product.price}\n`;
  }
  
  // Stock status
  if (product.stock <= 0) {
    message += `❌ Out of Stock\n`;
  } else if (product.stock <= 5) {
    message += `⚡ Only ${product.stock} left! Order now!\n`;
  } else {
    message += `✅ In Stock\n`;
  }
  
  message += `\n📦 Free shipping on orders above ₹499`;
  
  // Buttons based on stock
  let buttons;
  
  if (product.stock > 0) {
    buttons = [
      { id: `buy_${sku}`, title: '🛒 Buy Now' },
      { id: `add_${sku}`, title: '➕ Add to Cart' },
      { id: 'shop_now', title: '👀 More Products' },
    ];
  } else {
    buttons = [
      { id: 'shop_now', title: '👀 View Similar' },
      { id: 'talk_support', title: '🔔 Notify Me' },
    ];
  }
  
  await sendButtons(phone, message, buttons, env);
  
  // Log view
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, product_id, created_at)
    VALUES ('catalog', 'view_product', ?, ?, datetime('now'))
  `).bind(phone, sku).run().catch(() => {});
}

// ═════════════════════════════════════════════════════════════════
// SEARCH PRODUCTS
// ═════════════════════════════════════════════════════════════════

async function searchProducts(phone, query, env) {
  if (!query || query.length < 2) {
    await sendText(phone, "Please enter at least 2 characters to search.", env);
    return;
  }
  
  const searchPattern = `%${query}%`;
  
  const { results: products } = await env.DB.prepare(`
    SELECT * FROM products
    WHERE is_active = 1
    AND (
      name LIKE ? OR
      description LIKE ? OR
      category LIKE ? OR
      tags LIKE ?
    )
    ORDER BY 
      CASE WHEN name LIKE ? THEN 1 ELSE 2 END,
      order_count DESC
    LIMIT 10
  `).bind(searchPattern, searchPattern, searchPattern, searchPattern, `%${query}%`).all();
  
  if (!products?.length) {
    const message = `No products found for "${query}" 🔍\n\nTry:\n• Using different keywords\n• Browsing our categories`;
    
    const buttons = [
      { id: 'shop_now', title: '🛍️ Browse All' },
      { id: 'talk_support', title: '💬 Ask Us' },
    ];
    
    await sendButtons(phone, message, buttons, env);
    return;
  }
  
  let message = `🔍 Results for "${query}"\n\n`;
  
  products.forEach((p, i) => {
    message += `${i + 1}. ${p.name} - ₹${p.price}\n`;
  });
  
  const sections = [{
    title: 'Search Results',
    rows: products.map(p => ({
      id: `prod_${p.sku}`,
      title: p.name.slice(0, 24),
      description: `₹${p.price}`,
    })),
  }];
  
  await sendList(phone, message, 'View Products', sections, env);
  
  // Log search
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, data, created_at)
    VALUES ('catalog', 'search', ?, ?, datetime('now'))
  `).bind(phone, JSON.stringify({ query, results: products.length })).run().catch(() => {});
}

// ═════════════════════════════════════════════════════════════════
// SHOW FEATURED PRODUCTS
// ═════════════════════════════════════════════════════════════════

export async function showFeaturedProducts(phone, env) {
  const { results: products } = await env.DB.prepare(`
    SELECT * FROM products
    WHERE is_active = 1 AND is_featured = 1 AND stock > 0
    ORDER BY order_count DESC
    LIMIT 5
  `).all();
  
  if (!products?.length) {
    return showCategories(phone, env);
  }
  
  let message = "⭐ *Featured Products*\n\nOur best sellers:\n\n";
  
  products.forEach((p, i) => {
    message += `${i + 1}. *${p.name}* - ₹${p.price}\n`;
  });
  
  const sections = [{
    title: 'Featured',
    rows: products.map(p => ({
      id: `prod_${p.sku}`,
      title: p.name.slice(0, 24),
      description: `₹${p.price} ⭐`,
    })),
  }];
  
  await sendList(phone, message, 'View Products', sections, env);
}

// ═════════════════════════════════════════════════════════════════
// SHOW NEW ARRIVALS
// ═════════════════════════════════════════════════════════════════

export async function showNewArrivals(phone, env) {
  const { results: products } = await env.DB.prepare(`
    SELECT * FROM products
    WHERE is_active = 1 AND stock > 0
    ORDER BY created_at DESC
    LIMIT 5
  `).all();
  
  if (!products?.length) {
    return showCategories(phone, env);
  }
  
  let message = "🆕 *New Arrivals*\n\nJust added to our collection:\n\n";
  
  products.forEach((p, i) => {
    message += `${i + 1}. *${p.name}* - ₹${p.price}\n`;
  });
  
  const sections = [{
    title: 'New Arrivals',
    rows: products.map(p => ({
      id: `prod_${p.sku}`,
      title: p.name.slice(0, 24),
      description: `₹${p.price} 🆕`,
    })),
  }];
  
  await sendList(phone, message, 'View Products', sections, env);
}