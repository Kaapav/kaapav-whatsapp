/**
 * ════════════════════════════════════════════════════════════════
 * SHIPROCKET SHIPPING SERVICE
 * Complete shipping integration
 * ════════════════════════════════════════════════════════════════
 */

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

// ═════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═════════════════════════════════════════════════════════════════

async function getToken(env) {
  // Check cached token
  if (env.KV) {
    const cached = await env.KV.get('shiprocket_token', 'json');
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
  }
  
  // Generate new token
  const response = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    }),
  });
  
  const data = await response.json();
  
  if (!response.ok || !data.token) {
    throw new Error(data.message || 'Failed to authenticate with Shiprocket');
  }
  
  // Cache token (valid for 10 days, we cache for 9)
  if (env.KV) {
    await env.KV.put('shiprocket_token', JSON.stringify({
      token: data.token,
      expiresAt: Date.now() + (9 * 24 * 60 * 60 * 1000),
    }), { expirationTtl: 9 * 24 * 60 * 60 });
  }
  
  return data.token;
}

async function callShiprocketAPI(endpoint, method, data, env) {
  try {
    const token = await getToken(env);
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${SHIPROCKET_API}${endpoint}`;
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      console.error('[Shiprocket] Error:', result.message || 'Unknown error');
      return {
        success: false,
        error: result.message || 'API request failed',
      };
    }
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[Shiprocket] Network error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ═════════════════════════════════════════════════════════════════
// CHECK SERVICEABILITY
// ═════════════════════════════════════════════════════════════════

export async function getServiceability(pickupPincode, deliveryPincode, weight, cod, env) {
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: weight || 0.5,
    cod: cod ? 1 : 0,
  });
  
  const result = await callShiprocketAPI(`/courier/serviceability/?${params}`, 'GET', null, env);
  
  if (result.success && result.data?.data?.available_courier_companies) {
    const couriers = result.data.data.available_courier_companies;
    
    return {
      success: true,
      serviceable: couriers.length > 0,
      codAvailable: couriers.some(c => c.cod === 1),
      estimatedDays: couriers[0]?.estimated_delivery_days,
      couriers: couriers.slice(0, 5).map(c => ({
        id: c.courier_company_id,
        name: c.courier_name,
        rate: c.rate,
        estimatedDays: c.estimated_delivery_days,
        codAvailable: c.cod === 1,
      })),
    };
  }
  
  return {
    success: false,
    serviceable: false,
    error: result.error || 'Serviceability check failed',
  };
}

// ═════════════════════════════════════════════════════════════════
// GET AVAILABLE COURIERS
// ═════════════════════════════════════════════════════════════════

export async function getCouriers(pickupPincode, deliveryPincode, weight, cod, env) {
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: weight || 0.5,
    cod: cod ? 1 : 0,
  });
  
  const result = await callShiprocketAPI(`/courier/serviceability/?${params}`, 'GET', null, env);
  
  if (result.success) {
    return {
      success: true,
      couriers: result.data?.data?.available_courier_companies || [],
    };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// CREATE SHIPMENT
// ═════════════════════════════════════════════════════════════════

export async function createShipment(order, env, courierId = null) {
  const items = JSON.parse(order.items);
  
  // Calculate dimensions (default)
  const length = 20;
  const breadth = 15;
  const height = 10;
  const weight = 0.5;
  
  const orderData = {
    order_id: order.order_id,
    order_date: new Date(order.created_at).toISOString().split('T')[0],
    pickup_location: 'Primary', // Default pickup location name
    channel_id: '',
    comment: order.customer_notes || '',
    billing_customer_name: order.shipping_name || order.customer_name,
    billing_last_name: '',
    billing_address: order.shipping_address,
    billing_address_2: '',
    billing_city: order.shipping_city,
    billing_pincode: order.shipping_pincode,
    billing_state: order.shipping_state,
    billing_country: 'India',
    billing_email: '',
    billing_phone: order.shipping_phone || order.phone,
    shipping_is_billing: true,
    order_items: items.map(item => ({
      name: item.name,
      sku: item.sku,
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: '',
    })),
    payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: order.shipping_cost || 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: order.discount || 0,
    sub_total: order.subtotal,
    length,
    breadth,
    height,
    weight,
  };
  
  // Step 1: Create order
  const createResult = await callShiprocketAPI('/orders/create/adhoc', 'POST', orderData, env);
  
  if (!createResult.success) {
    return createResult;
  }
  
  const shiprocketOrderId = createResult.data.order_id;
  const shipmentId = createResult.data.shipment_id;
  
  // Step 2: Generate AWB
  const awbData = {
    shipment_id: shipmentId,
  };
  
  if (courierId) {
    awbData.courier_id = courierId;
  }
  
  const awbResult = await callShiprocketAPI('/courier/assign/awb', 'POST', awbData, env);
  
  if (!awbResult.success) {
    return {
      success: false,
      error: 'Order created but AWB generation failed: ' + awbResult.error,
      shiprocketOrderId,
      shipmentId,
    };
  }
  
  const awb = awbResult.data.response?.data?.awb_code;
  const courier = awbResult.data.response?.data?.courier_name;
  
  return {
    success: true,
    shiprocketOrderId,
    shipmentId,
    awb,
    courier,
    trackingUrl: `https://shiprocket.co/tracking/${awb}`,
  };
}

// ═════════════════════════════════════════════════════════════════
// GET TRACKING
// ═════════════════════════════════════════════════════════════════

export async function getTracking(awb, env) {
  const result = await callShiprocketAPI(`/courier/track/awb/${awb}`, 'GET', null, env);
  
  if (result.success && result.data?.tracking_data) {
    const tracking = result.data.tracking_data;
    
    return {
      success: true,
      status: tracking.shipment_status,
      currentLocation: tracking.current_location,
      estimatedDelivery: tracking.etd,
      activities: (tracking.shipment_track || []).map(a => ({
        date: a.date,
        status: a.status,
        activity: a.activity,
        location: a.location,
      })),
    };
  }
  
  return {
    success: false,
    error: result.error || 'Tracking not available',
  };
}

// ═════════════════════════════════════════════════════════════════
// CANCEL SHIPMENT
// ═════════════════════════════════════════════════════════════════

export async function cancelShipment(awb, env) {
  const result = await callShiprocketAPI('/orders/cancel/shipment/awbs', 'POST', {
    awbs: [awb],
  }, env);
  
  if (result.success) {
    return { success: true };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// GENERATE SHIPPING LABEL
// ═════════════════════════════════════════════════════════════════

export async function generateLabel(shipmentId, env) {
  const result = await callShiprocketAPI('/courier/generate/label', 'POST', {
    shipment_id: [shipmentId],
  }, env);
  
  if (result.success && result.data?.label_url) {
    return {
      success: true,
      labelUrl: result.data.label_url,
    };
  }
  
  return {
    success: false,
    error: result.error || 'Label generation failed',
  };
}

// ═════════════════════════════════════════════════════════════════
// GENERATE MANIFEST
// ═════════════════════════════════════════════════════════════════

export async function generateManifest(shipmentIds, env) {
  const result = await callShiprocketAPI('/manifests/generate', 'POST', {
    shipment_id: shipmentIds,
  }, env);
  
  if (result.success && result.data?.manifest_url) {
    return {
      success: true,
      manifestUrl: result.data.manifest_url,
    };
  }
  
  return {
    success: false,
    error: result.error || 'Manifest generation failed',
  };
}

// ═════════════════════════════════════════════════════════════════
// REQUEST PICKUP
// ═════════════════════════════════════════════════════════════════

export async function requestPickup(shipmentIds, pickupDate, pickupTime, env) {
  const result = await callShiprocketAPI('/courier/generate/pickup', 'POST', {
    shipment_id: shipmentIds,
    pickup_date: pickupDate,
    pickup_time: pickupTime,
  }, env);
  
  if (result.success && result.data?.pickup_scheduled_date) {
    return {
      success: true,
      pickupId: result.data.pickup_id,
      scheduledDate: result.data.pickup_scheduled_date,
    };
  }
  
  return {
    success: false,
    error: result.error || 'Pickup scheduling failed',
  };
}

// ═════════════════════════════════════════════════════════════════
// GET PICKUP LOCATIONS
// ═════════════════════════════════════════════════════════════════

export async function getPickupLocations(env) {
  const result = await callShiprocketAPI('/settings/company/pickup', 'GET', null, env);
  
  if (result.success) {
    return {
      success: true,
      locations: result.data?.data?.shipping_address || [],
    };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// ADD PICKUP LOCATION
// ═════════════════════════════════════════════════════════════════

export async function addPickupLocation(location, env) {
  const result = await callShiprocketAPI('/settings/company/addpickup', 'POST', {
    pickup_location: location.name,
    name: location.contactName,
    email: location.email,
    phone: location.phone,
    address: location.address,
    address_2: location.address2 || '',
    city: location.city,
    state: location.state,
    country: 'India',
    pin_code: location.pincode,
  }, env);
  
  if (result.success) {
    return {
      success: true,
      locationId: result.data?.address?.id,
    };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// GET NDR (Non-Delivery Reports)
// ═════════════════════════════════════════════════════════════════

export async function getNDR(env) {
  const result = await callShiprocketAPI('/orders/ndr', 'GET', null, env);
  
  if (result.success) {
    return {
      success: true,
      ndrs: result.data?.data || [],
    };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// ACTION NDR
// ═════════════════════════════════════════════════════════════════

export async function actionNDR(awb, action, comments, env) {
  // action: 're-attempt', 'return'
  const result = await callShiprocketAPI('/orders/ndr/action', 'POST', {
    awb,
    action,
    comments,
  }, env);
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// CALCULATE SHIPPING RATES
// ═════════════════════════════════════════════════════════════════

export async function calculateRates(pickupPincode, deliveryPincode, weight, cod, declaredValue, env) {
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: weight,
    cod: cod ? 1 : 0,
    declared_value: declaredValue || 0,
  });
  
  const result = await callShiprocketAPI(`/courier/serviceability/?${params}`, 'GET', null, env);
  
  if (result.success) {
    return {
      success: true,
      rates: (result.data?.data?.available_courier_companies || []).map(c => ({
        courierId: c.courier_company_id,
        courierName: c.courier_name,
        rate: c.rate,
        estimatedDays: c.estimated_delivery_days,
        codAvailable: c.cod === 1,
        codCharges: c.cod_charges || 0,
      })),
    };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// GET RETURN ORDERS
// ═════════════════════════════════════════════════════════════════

export async function getReturnOrders(env) {
  const result = await callShiprocketAPI('/orders/processing/return', 'GET', null, env);
  
  if (result.success) {
    return {
      success: true,
      returns: result.data?.data || [],
    };
  }
  
  return result;
}

// ═════════════════════════════════════════════════════════════════
// CREATE RETURN ORDER
// ═════════════════════════════════════════════════════════════════

export async function createReturnOrder(originalOrderId, items, reason, env) {
  const result = await callShiprocketAPI('/orders/create/return', 'POST', {
    order_id: originalOrderId,
    order_items: items,
    reason,
  }, env);
  
  if (result.success) {
    return {
      success: true,
      returnOrderId: result.data?.order_id,
      shipmentId: result.data?.shipment_id,
    };
  }
  
  return result;
}