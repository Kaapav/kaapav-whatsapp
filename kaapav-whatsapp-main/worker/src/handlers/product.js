/**
 * ════════════════════════════════════════════════════════════════
 * PRODUCT HANDLER
 * Complete product catalog management
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleProduct(request, ctx, path) {
  const { method, env, url } = ctx;
  
  try {
    // ─────────────────────────────────────────────────────────────
    // GET /api/products - List products
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/products' && method === 'GET') {
      return getProducts(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/products/categories - Get categories
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/products/categories' && method === 'GET') {
      return getCategories(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/products/low-stock - Low stock products
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/products/low-stock' && method === 'GET') {
      return getLowStock(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/products - Create product
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/products' && method === 'POST') {
      return createProduct(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/products/:sku - Get single product
    // ─────────────────────────────────────────────────────────────
    const skuMatch = path.match(/^\/api\/products\/([A-Za-z0-9_-]+)$/);
    if (skuMatch && method === 'GET') {
      return getProduct(skuMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // PUT /api/products/:sku - Update product
    // ─────────────────────────────────────────────────────────────
    if (skuMatch && method === 'PUT') {
      return updateProduct(skuMatch[1], await request.json(), ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // DELETE /api/products/:sku - Delete product
    // ─────────────────────────────────────────────────────────────
    if (skuMatch && method === 'DELETE') {
      return deleteProduct(skuMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/products/:sku/stock - Update stock
    // ─────────────────────────────────────────────────────────────
    const stockMatch = path.match(/^\/api\/products\/([A-Za-z0-9_-]+)\/stock$/);
    if (stockMatch && method === 'POST') {
      return updateStock(stockMatch[1], await request.json(), ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/products/bulk-import - Bulk import
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/products/bulk-import' && method === 'POST') {
      return bulkImport(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/products/upload-image - Upload image
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/products/upload-image' && method === 'POST') {
      return uploadImage(request, ctx);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Product] Error:', error.message);
    return errorResponse('Failed to process product request', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// GET PRODUCTS LIST
// ═════════════════════════════════════════════════════════════════

async function getProducts(ctx) {
  const { env, url } = ctx;
  
  const category = url.searchParams.get('category');
  const subcategory = url.searchParams.get('subcategory');
  const search = url.searchParams.get('search');
  const inStock = url.searchParams.get('in_stock');
  const featured = url.searchParams.get('featured');
  const sortBy = url.searchParams.get('sort') || 'created_at';
  const sortOrder = url.searchParams.get('order') || 'desc';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  let query = `SELECT * FROM products WHERE is_active = 1`;
  const params = [];
  
  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }
  
  if (subcategory) {
    query += ` AND subcategory = ?`;
    params.push(subcategory);
  }
  
  if (search) {
    query += ` AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)`;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  
  if (inStock === 'true') {
    query += ` AND stock > 0`;
  }
  
  if (featured === 'true') {
    query += ` AND is_featured = 1`;
  }
  
  // Count total
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const { total } = await env.DB.prepare(countQuery).bind(...params).first() || { total: 0 };
  
  // Sorting
  const allowedSorts = ['created_at', 'price', 'name', 'stock', 'order_count'];
  const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  
  query += ` ORDER BY is_featured DESC, ${sortColumn} ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({
    products: results.map(formatProduct),
    total,
    limit,
    offset,
  });
}

// ═════════════════════════════════════════════════════════════════
// GET CATEGORIES
// ═════════════════════════════════════════════════════════════════

async function getCategories(ctx) {
  const { env } = ctx;
  
  const { results } = await env.DB.prepare(`
    SELECT 
      category,
      subcategory,
      COUNT(*) as product_count,
      SUM(stock) as total_stock
    FROM products
    WHERE is_active = 1
    GROUP BY category, subcategory
    ORDER BY category, subcategory
  `).all();
  
  // Organize into hierarchy
  const categories = {};
  
  for (const row of results) {
    if (!categories[row.category]) {
      categories[row.category] = {
        name: row.category,
        productCount: 0,
        totalStock: 0,
        subcategories: [],
      };
    }
    
    categories[row.category].productCount += row.product_count;
    categories[row.category].totalStock += row.total_stock || 0;
    
    if (row.subcategory) {
      categories[row.category].subcategories.push({
        name: row.subcategory,
        productCount: row.product_count,
        totalStock: row.total_stock || 0,
      });
    }
  }
  
  return jsonResponse({
    categories: Object.values(categories),
  });
}

// ═════════════════════════════════════════════════════════════════
// GET LOW STOCK PRODUCTS
// ═════════════════════════════════════════════════════════════════

async function getLowStock(ctx) {
  const { env, url } = ctx;
  
  const threshold = parseInt(url.searchParams.get('threshold') || '10');
  
  const { results } = await env.DB.prepare(`
    SELECT * FROM products
    WHERE is_active = 1 AND track_inventory = 1 AND stock <= ?
    ORDER BY stock ASC
    LIMIT 50
  `).bind(threshold).all();
  
  return jsonResponse({
    products: results.map(formatProduct),
    threshold,
  });
}

// ═════════════════════════════════════════════════════════════════
// GET SINGLE PRODUCT
// ═════════════════════════════════════════════════════════════════

async function getProduct(sku, ctx) {
  const { env } = ctx;
  
  const product = await env.DB.prepare(`
    SELECT * FROM products WHERE sku = ?
  `).bind(sku).first();
  
  if (!product) {
    return errorResponse('Product not found', 404);
  }
  
  // Get order history for this product
  const { results: orderStats } = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(json_extract(items.value, '$.quantity')) as total_sold
    FROM orders, json_each(orders.items) as items
    WHERE json_extract(items.value, '$.sku') = ?
    AND orders.status != 'cancelled'
  `).bind(sku).all();
  
  return jsonResponse({
    product: formatProduct(product),
    stats: {
      totalOrders: orderStats[0]?.total_orders || 0,
      totalSold: orderStats[0]?.total_sold || 0,
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// CREATE PRODUCT
// ═════════════════════════════════════════════════════════════════

async function createProduct(request, ctx) {
  const { env } = ctx;
  const data = await request.json();
  
  const {
    sku,
    name,
    description,
    price,
    comparePrice,
    costPrice,
    category,
    subcategory,
    tags,
    stock,
    trackInventory,
    imageUrl,
    images,
    videoUrl,
    variants,
    isFeatured,
  } = data;
  
  if (!sku || !name || !price) {
    return errorResponse('SKU, name, and price required');
  }
  
  // Check for duplicate SKU
  const existing = await env.DB.prepare(`
    SELECT sku FROM products WHERE sku = ?
  `).bind(sku).first();
  
  if (existing) {
    return errorResponse('SKU already exists');
  }
  
  await env.DB.prepare(`
    INSERT INTO products (
      sku, name, description, price, compare_price, cost_price,
      category, subcategory, tags, stock, track_inventory,
      image_url, images, video_url, has_variants, variants,
      is_featured, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).bind(
    sku,
    name,
    description,
    price,
    comparePrice || null,
    costPrice || null,
    category,
    subcategory,
    JSON.stringify(tags || []),
    stock || 0,
    trackInventory !== false ? 1 : 0,
    imageUrl,
    JSON.stringify(images || []),
    videoUrl,
    variants?.length > 0 ? 1 : 0,
    JSON.stringify(variants || []),
    isFeatured ? 1 : 0
  ).run();
  
  return jsonResponse({ success: true, sku }, 201);
}

// ═════════════════════════════════════════════════════════════════
// UPDATE PRODUCT
// ═════════════════════════════════════════════════════════════════

async function updateProduct(sku, data, ctx) {
  const { env } = ctx;
  
  const existing = await env.DB.prepare(`
    SELECT id FROM products WHERE sku = ?
  `).bind(sku).first();
  
  if (!existing) {
    return errorResponse('Product not found', 404);
  }
  
  const updates = [];
  const params = [];
  
  const fieldMap = {
    name: 'name',
    description: 'description',
    price: 'price',
    comparePrice: 'compare_price',
    costPrice: 'cost_price',
    category: 'category',
    subcategory: 'subcategory',
    stock: 'stock',
    trackInventory: 'track_inventory',
    imageUrl: 'image_url',
    videoUrl: 'video_url',
    isFeatured: 'is_featured',
    isActive: 'is_active',
  };
  
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      updates.push(`${column} = ?`);
      const value = typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key];
      params.push(value);
    }
  }
  
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }
  
  if (data.images !== undefined) {
    updates.push('images = ?');
    params.push(JSON.stringify(data.images));
  }
  
  if (data.variants !== undefined) {
    updates.push('variants = ?');
    updates.push('has_variants = ?');
    params.push(JSON.stringify(data.variants));
    params.push(data.variants.length > 0 ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return errorResponse('No updates provided');
  }
  
  updates.push('updated_at = datetime("now")');
  params.push(sku);
  
  await env.DB.prepare(`
    UPDATE products SET ${updates.join(', ')} WHERE sku = ?
  `).bind(...params).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// DELETE PRODUCT (Soft delete)
// ═════════════════════════════════════════════════════════════════

async function deleteProduct(sku, ctx) {
  const { env } = ctx;
  
  await env.DB.prepare(`
    UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE sku = ?
  `).bind(sku).run();
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// UPDATE STOCK
// ═════════════════════════════════════════════════════════════════

async function updateStock(sku, data, ctx) {
  const { env } = ctx;
  const { action, quantity, reason } = data;
  
  if (!quantity || quantity <= 0) {
    return errorResponse('Valid quantity required');
  }
  
  const product = await env.DB.prepare(`
    SELECT stock FROM products WHERE sku = ?
  `).bind(sku).first();
  
  if (!product) {
    return errorResponse('Product not found', 404);
  }
  
  let newStock;
  
  switch (action) {
    case 'set':
      newStock = quantity;
      break;
    case 'add':
      newStock = product.stock + quantity;
      break;
    case 'subtract':
      newStock = Math.max(0, product.stock - quantity);
      break;
    default:
      return errorResponse('Invalid action. Use set, add, or subtract');
  }
  
  await env.DB.prepare(`
    UPDATE products SET stock = ?, updated_at = datetime('now') WHERE sku = ?
  `).bind(newStock, sku).run();
  
  // Log stock change
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, product_id, data, created_at)
    VALUES ('stock', ?, ?, ?, datetime('now'))
  `).bind(action, sku, JSON.stringify({ quantity, reason, newStock })).run();
  
  return jsonResponse({ success: true, newStock });
}

// ═════════════════════════════════════════════════════════════════
// BULK IMPORT
// ═════════════════════════════════════════════════════════════════

async function bulkImport(request, ctx) {
  const { env, ctx: workerCtx } = ctx;
  const { products } = await request.json();
  
  if (!products?.length) {
    return errorResponse('Products array required');
  }
  
  if (products.length > 500) {
    return errorResponse('Max 500 products per import');
  }
  
  // Process in background
  workerCtx.waitUntil(processBulkImport(products, env));
  
  return jsonResponse({
    success: true,
    message: `Importing ${products.length} products`,
  });
}

async function processBulkImport(products, env) {
  let imported = 0;
  let updated = 0;
  let failed = 0;
  
  for (const product of products) {
    try {
      const existing = await env.DB.prepare(`
        SELECT sku FROM products WHERE sku = ?
      `).bind(product.sku).first();
      
      if (existing) {
        // Update existing
        await env.DB.prepare(`
          UPDATE products SET
            name = ?, price = ?, stock = ?, category = ?,
            image_url = ?, updated_at = datetime('now')
          WHERE sku = ?
        `).bind(
          product.name,
          product.price,
          product.stock || 0,
          product.category,
          product.imageUrl,
          product.sku
        ).run();
        updated++;
      } else {
        // Insert new
        await env.DB.prepare(`
          INSERT INTO products (sku, name, price, stock, category, image_url, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
        `).bind(
          product.sku,
          product.name,
          product.price,
          product.stock || 0,
          product.category,
          product.imageUrl
        ).run();
        imported++;
      }
    } catch (error) {
      console.error(`[BulkImport] Failed for ${product.sku}:`, error.message);
      failed++;
    }
  }
  
  console.log(`[BulkImport] Complete: ${imported} imported, ${updated} updated, ${failed} failed`);
}

// ═════════════════════════════════════════════════════════════════
// UPLOAD IMAGE (to R2)
// ═════════════════════════════════════════════════════════════════

async function uploadImage(request, ctx) {
  const { env } = ctx;
  
  if (!env.R2) {
    return errorResponse('Storage not configured');
  }
  
  const formData = await request.formData();
  const file = formData.get('file');
  
  if (!file) {
    return errorResponse('No file provided');
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return errorResponse('Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
  }
  
  // Max size 5MB
  if (file.size > 5 * 1024 * 1024) {
    return errorResponse('File too large. Max 5MB');
  }
  
  // Generate unique filename
  const ext = file.name.split('.').pop();
  const filename = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  
  // Upload to R2
  await env.R2.put(filename, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  
  // Construct URL
  const imageUrl = `https://media.kaapav.com/${filename}`; // Configure your R2 custom domain
  
  return jsonResponse({
    success: true,
    url: imageUrl,
    filename,
  });
}

// ═════════════════════════════════════════════════════════════════
// FORMATTERS
// ═════════════════════════════════════════════════════════════════

function formatProduct(product) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    comparePrice: product.compare_price,
    costPrice: product.cost_price,
    category: product.category,
    subcategory: product.subcategory,
    tags: safeJsonParse(product.tags, []),
    stock: product.stock,
    trackInventory: product.track_inventory === 1,
    imageUrl: product.image_url,
    images: safeJsonParse(product.images, []),
    videoUrl: product.video_url,
    hasVariants: product.has_variants === 1,
    variants: safeJsonParse(product.variants, []),
    waProductId: product.wa_product_id,
    viewCount: product.view_count,
    orderCount: product.order_count,
    isFeatured: product.is_featured === 1,
    isActive: product.is_active === 1,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}