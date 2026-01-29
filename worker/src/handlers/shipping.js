/**
 * ════════════════════════════════════════════════════════════════
 * SHIPPING HANDLER
 * Shiprocket integration for order fulfillment
 * ════════════════════════════════════════════════════════════════
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { 
  createShipment, 
  getTracking, 
  cancelShipment, 
  getServiceability,
  getCouriers,
  generateLabel,
  generateManifest,
  requestPickup
} from '../services/shiprocket.js';

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleShipping(request, ctx, path) {
  const { method, env, url } = ctx;
  
  try {
    // ─────────────────────────────────────────────────────────────
    // POST /api/shipping/check - Check serviceability
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/check' && method === 'POST') {
      return checkServiceability(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/shipping/couriers - Get available couriers
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/couriers' && method === 'GET') {
      return getAvailableCouriers(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/shipping/create - Create shipment
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/create' && method === 'POST') {
      return createShipmentHandler(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/shipping/track/:awb - Track shipment
    // ─────────────────────────────────────────────────────────────
    const trackMatch = path.match(/^\/api\/shipping\/track\/([A-Za-z0-9]+)$/);
    if (trackMatch && method === 'GET') {
      return trackShipment(trackMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/shipping/cancel - Cancel shipment
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/cancel' && method === 'POST') {
      return cancelShipmentHandler(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/shipping/label/:shipmentId - Get shipping label
    // ─────────────────────────────────────────────────────────────
    const labelMatch = path.match(/^\/api\/shipping\/label\/(\d+)$/);
    if (labelMatch && method === 'GET') {
      return getLabel(labelMatch[1], ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/shipping/manifest - Generate manifest
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/manifest' && method === 'POST') {
      return generateManifestHandler(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/shipping/pickup - Request pickup
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/pickup' && method === 'POST') {
      return requestPickupHandler(request, ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // GET /api/shipping/pincodes - Get serviceable pincodes
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/pincodes' && method === 'GET') {
      return getPincodes(ctx);
    }
    
    // ─────────────────────────────────────────────────────────────
    // POST /api/shipping/pincodes - Add/update pincodes
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/shipping/pincodes' && method === 'POST') {
      return updatePincodes(request, ctx);
    }
    
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('[Shipping] Error:', error.message);
    return errorResponse('Shipping processing error', 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// CHECK SERVICEABILITY
// ═════════════════════════════════════════════════════════════════

async function checkServiceability(request, ctx) {
  const { env } = ctx;
  const { pickupPincode, deliveryPincode, weight, cod } = await request.json();
  
  if (!deliveryPincode) {
    return errorResponse('Delivery pincode required');
  }
  
  // Check local database first
  const localPincode = await env.DB.prepare(`
    SELECT * FROM pincodes WHERE pincode = ?
  `).bind(deliveryPincode).first();
  
  if (localPincode) {
    return jsonResponse({
      serviceable: localPincode.is_serviceable === 1,
      codAvailable: localPincode.cod_available === 1,
      deliveryDays: localPincode.delivery_days,
      shippingCost: localPincode.shipping_cost,
      city: localPincode.city,
      state: localPincode.state,
      source: 'local',
    });
  }
  
  // Check with Shiprocket
  const result = await getServiceability(
    pickupPincode || '110001', // Default pickup pincode
    deliveryPincode,
    weight || 0.5,
    cod,
    env
  );
  
  if (!result.success) {
    return jsonResponse({
      serviceable: false,
      message: result.error || 'Unable to check serviceability',
    });
  }
  
  return jsonResponse({
    serviceable: result.serviceable,
    codAvailable: result.codAvailable,
    estimatedDays: result.estimatedDays,
    couriers: result.couriers,
    source: 'shiprocket',
  });
}

// ═════════════════════════════════════════════════════════════════
// GET AVAILABLE COURIERS
// ═════════════════════════════════════════════════════════════════

async function getAvailableCouriers(ctx) {
  const { env, url } = ctx;
  
  const pickupPincode = url.searchParams.get('pickup') || '110001';
  const deliveryPincode = url.searchParams.get('delivery');
  const weight = parseFloat(url.searchParams.get('weight') || '0.5');
  const cod = url.searchParams.get('cod') === 'true';
  
  if (!deliveryPincode) {
    return errorResponse('Delivery pincode required');
  }
  
  const result = await getCouriers(pickupPincode, deliveryPincode, weight, cod, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to fetch couriers');
  }
  
  return jsonResponse({
    couriers: result.couriers.map(c => ({
      id: c.courier_company_id,
      name: c.courier_name,
      rate: c.rate,
      estimatedDays: c.estimated_delivery_days,
      codAvailable: c.cod === 1,
      rating: c.rating,
    })),
  });
}

// ═════════════════════════════════════════════════════════════════
// CREATE SHIPMENT
// ═════════════════════════════════════════════════════════════════

async function createShipmentHandler(request, ctx) {
  const { env } = ctx;
  const { orderId, courierId } = await request.json();
  
  if (!orderId) {
    return errorResponse('Order ID required');
  }
  
  // Get order
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();
  
  if (!order) {
    return errorResponse('Order not found', 404);
  }
  
  if (!order.shipping_pincode) {
    return errorResponse('Shipping address incomplete');
  }
  
  const result = await createShipment(order, env, courierId);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to create shipment');
  }
  
  // Update order
  await env.DB.prepare(`
    UPDATE orders SET
      status = 'shipped',
      shipment_id = ?,
      awb_number = ?,
      courier = ?,
      tracking_id = ?,
      tracking_url = ?,
      shipped_at = datetime('now'),
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(
    result.shipmentId,
    result.awb,
    result.courier,
    result.awb,
    result.trackingUrl,
    orderId
  ).run();
  
  return jsonResponse({
    success: true,
    shipmentId: result.shipmentId,
    awb: result.awb,
    courier: result.courier,
    trackingUrl: result.trackingUrl,
  });
}

// ═════════════════════════════════════════════════════════════════
// TRACK SHIPMENT
// ═════════════════════════════════════════════════════════════════

async function trackShipment(awb, ctx) {
  const { env } = ctx;
  
  const result = await getTracking(awb, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Tracking not available');
  }
  
  return jsonResponse({
    awb,
    status: result.status,
    currentLocation: result.currentLocation,
    estimatedDelivery: result.estimatedDelivery,
    activities: result.activities,
  });
}

// ═════════════════════════════════════════════════════════════════
// CANCEL SHIPMENT
// ═════════════════════════════════════════════════════════════════

async function cancelShipmentHandler(request, ctx) {
  const { env } = ctx;
  const { orderId, awb } = await request.json();
  
  if (!orderId && !awb) {
    return errorResponse('Order ID or AWB required');
  }
  
  let awbNumber = awb;
  
  if (orderId) {
    const order = await env.DB.prepare(`
      SELECT awb_number FROM orders WHERE order_id = ?
    `).bind(orderId).first();
    
    if (!order?.awb_number) {
      return errorResponse('Order not shipped yet');
    }
    
    awbNumber = order.awb_number;
  }
  
  const result = await cancelShipment(awbNumber, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to cancel shipment');
  }
  
  // Update order
  if (orderId) {
    await env.DB.prepare(`
      UPDATE orders SET
        status = 'confirmed',
        shipment_id = NULL,
        awb_number = NULL,
        tracking_id = NULL,
        tracking_url = NULL,
        shipped_at = NULL,
        updated_at = datetime('now')
      WHERE order_id = ?
    `).bind(orderId).run();
  }
  
  return jsonResponse({ success: true });
}

// ═════════════════════════════════════════════════════════════════
// GET LABEL
// ═════════════════════════════════════════════════════════════════

async function getLabel(shipmentId, ctx) {
  const { env } = ctx;
  
  const result = await generateLabel(shipmentId, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to generate label');
  }
  
  return jsonResponse({
    labelUrl: result.labelUrl,
  });
}

// ═════════════════════════════════════════════════════════════════
// GENERATE MANIFEST
// ═════════════════════════════════════════════════════════════════

async function generateManifestHandler(request, ctx) {
  const { env } = ctx;
  const { shipmentIds } = await request.json();
  
  if (!shipmentIds?.length) {
    return errorResponse('Shipment IDs required');
  }
  
  const result = await generateManifest(shipmentIds, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to generate manifest');
  }
  
  return jsonResponse({
    manifestUrl: result.manifestUrl,
  });
}

// ═════════════════════════════════════════════════════════════════
// REQUEST PICKUP
// ═════════════════════════════════════════════════════════════════

async function requestPickupHandler(request, ctx) {
  const { env } = ctx;
  const { shipmentIds, pickupDate, pickupTime } = await request.json();
  
  if (!shipmentIds?.length) {
    return errorResponse('Shipment IDs required');
  }
  
  const result = await requestPickup(shipmentIds, pickupDate, pickupTime, env);
  
  if (!result.success) {
    return errorResponse(result.error || 'Failed to schedule pickup');
  }
  
  return jsonResponse({
    success: true,
    pickupId: result.pickupId,
    scheduledDate: result.scheduledDate,
  });
}

// ═════════════════════════════════════════════════════════════════
// PINCODE MANAGEMENT
// ═════════════════════════════════════════════════════════════════

async function getPincodes(ctx) {
  const { env, url } = ctx;
  
  const search = url.searchParams.get('search');
  const serviceable = url.searchParams.get('serviceable');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  
  let query = `SELECT * FROM pincodes WHERE 1=1`;
  const params = [];
  
  if (search) {
    query += ` AND (pincode LIKE ? OR city LIKE ? OR state LIKE ?)`;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  
  if (serviceable !== null) {
    query += ` AND is_serviceable = ?`;
    params.push(serviceable === 'true' ? 1 : 0);
  }
  
  query += ` ORDER BY pincode LIMIT ?`;
  params.push(limit);
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  return jsonResponse({ pincodes: results });
}

async function updatePincodes(request, ctx) {
  const { env } = ctx;
  const { pincodes } = await request.json();
  
  if (!pincodes?.length) {
    return errorResponse('Pincodes array required');
  }
  
  let updated = 0;
  
  for (const pin of pincodes) {
    await env.DB.prepare(`
      INSERT INTO pincodes (pincode, city, state, is_serviceable, cod_available, delivery_days, shipping_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pincode) DO UPDATE SET
        city = ?, state = ?, is_serviceable = ?, cod_available = ?, delivery_days = ?, shipping_cost = ?
    `).bind(
      pin.pincode, pin.city, pin.state, 
      pin.serviceable ? 1 : 0, pin.codAvailable ? 1 : 0, 
      pin.deliveryDays || 5, pin.shippingCost || 0,
      pin.city, pin.state, 
      pin.serviceable ? 1 : 0, pin.codAvailable ? 1 : 0, 
      pin.deliveryDays || 5, pin.shippingCost || 0
    ).run();
    updated++;
  }
  
  return jsonResponse({ success: true, updated });
}