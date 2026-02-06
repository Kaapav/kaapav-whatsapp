/**
 * ════════════════════════════════════════════════════════════════
 * ORDER FLOW
 * Conversational order placement flow
 * ════════════════════════════════════════════════════════════════
 */

import { sendText, sendButtons, sendList, sendImage } from '../services/whatsapp.js';
import { createPaymentLink } from '../services/razorpay.js';
import { generateOrderId, CONFIG } from '../config.js';

// ═════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═════════════════════════════════════════════════════════════════

async function getFlowState(phone, env) {
  const state = await env.DB.prepare(`
    SELECT * FROM conversation_state WHERE phone = ?
  `).bind(phone).first();
  
  return state ? {
    flow: state.current_flow,
    step: state.current_step,
    data: safeJsonParse(state.flow_data, {}),
  } : null;
}

async function setFlowState(phone, step, data, env) {
  const existingData = await getFlowState(phone, env);
  const mergedData = { ...(existingData?.data || {}), ...data };
  
  await env.DB.prepare(`
    INSERT INTO conversation_state (phone, current_flow, current_step, flow_data, updated_at, expires_at)
    VALUES (?, 'order', ?, ?, datetime('now'), datetime('now', '+1 hour'))
    ON CONFLICT(phone) DO UPDATE SET
      current_flow = 'order',
      current_step = ?,
      flow_data = ?,
      updated_at = datetime('now')
  `).bind(phone, step, JSON.stringify(mergedData), step, JSON.stringify(mergedData)).run();
}

async function clearFlowState(phone, env) {
  await env.DB.prepare(`DELETE FROM conversation_state WHERE phone = ?`).bind(phone).run();
}

// ═════════════════════════════════════════════════════════════════
// MAIN FLOW HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleOrderFlow(phone, step, input, env) {
  console.log(`[OrderFlow] ${phone} - Step: ${step}`);
  
  switch (step) {
    case 'start':
      return startOrderFlow(phone, env);
      
    case 'check_cart':
      return checkCart(phone, env);
      
    case 'collect_address':
      return collectAddress(phone, env);
      
    case 'receive_name':
      return receiveName(phone, input.text, env);
      
    case 'receive_address':
      return receiveAddress(phone, input.text, env);
      
    case 'receive_city':
      return receiveCity(phone, input.text, env);
      
    case 'receive_pincode':
      return receivePincode(phone, input.text, env);
      
    case 'confirm_address':
      return confirmAddress(phone, env);
      
    case 'select_payment':
      return selectPayment(phone, env);
      
    case 'process_cod':
      return processCOD(phone, env);
      
    case 'process_online':
      return processOnlinePayment(phone, env);
      
    default:
      return handleStepInput(phone, step, input, env);
  }
}

// ═════════════════════════════════════════════════════════════════
// FLOW STEPS
// ═════════════════════════════════════════════════════════════════

async function startOrderFlow(phone, env) {
  // Get cart
  const cart = await env.DB.prepare(`
    SELECT * FROM carts WHERE phone = ? AND status = 'active'
  `).bind(phone).first();
  
  if (!cart || cart.item_count === 0) {
    const message = "Your cart is empty! 🛒\n\nBrowse our collection and add items to proceed.";
    const buttons = [{ id: 'shop_now', title: '🛍️ Shop Now' }];
    await sendButtons(phone, message, buttons, env);
    return;
  }
  
  // Check existing customer data
  const customer = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(phone).first();
  
  // Store cart data in flow
  await setFlowState(phone, 'check_cart', {
    cartItems: JSON.parse(cart.items),
    cartTotal: cart.total,
    existingAddress: customer?.address ? {
      name: customer.name,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    } : null,
  }, env);
  
  return checkCart(phone, env);
}

async function checkCart(phone, env) {
  const state = await getFlowState(phone, env);
  const { cartItems, cartTotal, existingAddress } = state.data;
  
  // Show cart summary
  let message = "📦 Order Summary\n\n";
  
  cartItems.forEach((item, i) => {
    message += `${i + 1}. ${item.name}\n`;
    message += `   ₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}\n`;
  });
  
  message += `\n─────────────────\n`;
  message += `Subtotal: ₹${cartTotal}\n`;
  
  // Calculate shipping
  const shipping = cartTotal >= CONFIG.BUSINESS.FREE_SHIPPING_ABOVE ? 0 : CONFIG.BUSINESS.DEFAULT_SHIPPING_COST;
  
  if (shipping > 0) {
    message += `Shipping: ₹${shipping}\n`;
  } else {
    message += `Shipping: FREE 🎉\n`;
  }
  
  const total = cartTotal + shipping;
  message += `\n*Total: ₹${total}*`;
  
  await setFlowState(phone, 'check_cart', { ...state.data, shipping, total }, env);
  
  if (existingAddress) {
    // Show existing address option
    message += `\n\n📍 Deliver to:\n${existingAddress.name}\n${existingAddress.address}\n${existingAddress.city}, ${existingAddress.pincode}`;
    
    const buttons = [
      { id: 'confirm_address', title: '✅ Confirm' },
      { id: 'change_address', title: '📝 Change Address' },
    ];
    
    await sendButtons(phone, message, buttons, env);
  } else {
    await sendText(phone, message, env);
    return collectAddress(phone, env);
  }
}

async function collectAddress(phone, env) {
  await setFlowState(phone, 'receive_name', {}, env);
  
  await sendText(phone, "Please share your delivery details.\n\nWhat is your *full name*?", env);
}

async function receiveName(phone, name, env) {
  if (!name || name.length < 2) {
    await sendText(phone, "Please enter a valid name.", env);
    return;
  }
  
  await setFlowState(phone, 'receive_address', { name }, env);
  
  await sendText(phone, `Thanks ${name}! 👋\n\nWhat is your *complete address*? (House/Flat No., Street, Landmark)`, env);
}

async function receiveAddress(phone, address, env) {
  if (!address || address.length < 10) {
    await sendText(phone, "Please enter a complete address with house number, street, and landmark.", env);
    return;
  }
  
  await setFlowState(phone, 'receive_city', { address }, env);
  
  await sendText(phone, "Which *city* should we deliver to?", env);
}

async function receiveCity(phone, city, env) {
  if (!city || city.length < 2) {
    await sendText(phone, "Please enter a valid city name.", env);
    return;
  }
  
  await setFlowState(phone, 'receive_pincode', { city }, env);
  
  await sendText(phone, "And the *pincode*?", env);
}

async function receivePincode(phone, pincode, env) {
  // Validate pincode format
  const cleanPincode = pincode.replace(/\D/g, '');
  
  if (cleanPincode.length !== 6) {
    await sendText(phone, "Please enter a valid 6-digit pincode.", env);
    return;
  }
  
  // Check serviceability
  const pincodeData = await env.DB.prepare(`
    SELECT * FROM pincodes WHERE pincode = ?
  `).bind(cleanPincode).first();
  
  if (pincodeData && !pincodeData.is_serviceable) {
    await sendText(phone, `Sorry, we don't deliver to pincode ${cleanPincode} yet. 😔\n\nPlease enter a different pincode.`, env);
    return;
  }
  
  // Get state from pincode (simple mapping, can be enhanced)
  const state = pincodeData?.state || 'India';
  
  await setFlowState(phone, 'confirm_address', { pincode: cleanPincode, state }, env);
  
  return confirmAddress(phone, env);
}

async function confirmAddress(phone, env) {
  const flowState = await getFlowState(phone, env);
  const { name, address, city, pincode, state, cartTotal, shipping, total } = flowState.data;
  
  // Update customer address
  await env.DB.prepare(`
    UPDATE customers SET
      name = COALESCE(?, name),
      address = ?,
      city = ?,
      state = ?,
      pincode = ?,
      updated_at = datetime('now')
    WHERE phone = ?
  `).bind(name, address, city, state, pincode, phone).run();
  
  // Store complete address in flow
  await setFlowState(phone, 'select_payment', {
    ...flowState.data,
    shippingAddress: { name, address, city, state, pincode },
  }, env);
  
  const message = `📍 Delivery Address

${name}
${address}
${city}, ${state} - ${pincode}
📞 ${phone}

💰 Amount: ₹${total}

Please select payment method:`;
  
  const buttons = [
    { id: 'pay_online', title: '💳 Pay Online' },
    { id: 'pay_cod', title: '💵 Cash on Delivery' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

async function selectPayment(phone, env) {
  const message = "How would you like to pay?";
  
  const buttons = [
    { id: 'pay_online', title: '💳 Pay Online' },
    { id: 'pay_cod', title: '💵 Cash on Delivery' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

async function processCOD(phone, env) {
  const flowState = await getFlowState(phone, env);
  const { cartItems, shippingAddress, total, shipping } = flowState.data;
  
  // Check COD limits
  if (total > CONFIG.BUSINESS.COD_MAX_ORDER) {
    await sendText(phone, `COD is not available for orders above ₹${CONFIG.BUSINESS.COD_MAX_ORDER}. Please select online payment.`, env);
    return selectPayment(phone, env);
  }
  
  // Calculate COD charges
  const codCharge = CONFIG.BUSINESS.COD_CHARGE;
  const finalTotal = total + codCharge;
  
  // Create order
  const orderId = generateOrderId();
  
  await env.DB.prepare(`
    INSERT INTO orders (
      order_id, phone, customer_name, items, item_count,
      subtotal, shipping_cost, total,
      shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_pincode,
      status, payment_status, payment_method, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'unpaid', 'cod', 'whatsapp', datetime('now'))
  `).bind(
    orderId, phone, shippingAddress.name,
    JSON.stringify(cartItems), cartItems.reduce((sum, i) => sum + i.quantity, 0),
    total - shipping, shipping, finalTotal,
    shippingAddress.name, phone,
    shippingAddress.address, shippingAddress.city, shippingAddress.state, shippingAddress.pincode
  ).run();
  
  // Update inventory
  for (const item of cartItems) {
    await env.DB.prepare(`
      UPDATE products SET stock = stock - ?, order_count = order_count + 1 WHERE sku = ?
    `).bind(item.quantity, item.sku).run();
  }
  
  // Clear cart
  await env.DB.prepare(`
    UPDATE carts SET status = 'converted', converted_at = datetime('now') WHERE phone = ?
  `).bind(phone).run();
  
  // Clear flow state
  await clearFlowState(phone, env);
  
  // Send confirmation
  const message = `✅ Order Confirmed!

📦 Order ID: ${orderId}
💰 Amount: ₹${finalTotal}
💵 Payment: Cash on Delivery

📍 Delivering to:
${shippingAddress.name}
${shippingAddress.address}
${shippingAddress.city} - ${shippingAddress.pincode}

We're preparing your order! 🎁

Expected delivery: 3-5 business days`;
  
  const buttons = [
    { id: `order_track_${orderId}`, title: '📦 Track Order' },
    { id: 'shop_now', title: '🛍️ Shop More' },
  ];
  
  await sendButtons(phone, message, buttons, env);
  
  // Log event
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, order_id, data, created_at)
    VALUES ('order', 'order_placed', ?, ?, ?, datetime('now'))
  `).bind(phone, orderId, JSON.stringify({ total: finalTotal, method: 'cod' })).run();
}

async function processOnlinePayment(phone, env) {
  const flowState = await getFlowState(phone, env);
  const { cartItems, shippingAddress, total, shipping } = flowState.data;
  
  // Create order with pending payment
  const orderId = generateOrderId();
  
  await env.DB.prepare(`
    INSERT INTO orders (
      order_id, phone, customer_name, items, item_count,
      subtotal, shipping_cost, total,
      shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_pincode,
      status, payment_status, payment_method, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'online', 'whatsapp', datetime('now'))
  `).bind(
    orderId, phone, shippingAddress.name,
    JSON.stringify(cartItems), cartItems.reduce((sum, i) => sum + i.quantity, 0),
    total - shipping, shipping, total,
    shippingAddress.name, phone,
    shippingAddress.address, shippingAddress.city, shippingAddress.state, shippingAddress.pincode
  ).run();
  
  // Get customer details
  const customer = await env.DB.prepare(`
    SELECT name, email FROM customers WHERE phone = ?
  `).bind(phone).first();
  
  // Create payment link
  const paymentResult = await createPaymentLink(orderId, total, {
    name: customer?.name || shippingAddress.name,
    email: customer?.email,
    phone,
  }, env);
  
  if (!paymentResult.success) {
    await sendText(phone, "Sorry, we couldn't create the payment link. Please try again or choose COD.", env);
    return selectPayment(phone, env);
  }
  
  // Update order with payment link
  await env.DB.prepare(`
    UPDATE orders SET payment_link = ?, payment_link_expires = datetime('now', '+24 hours')
    WHERE order_id = ?
  `).bind(paymentResult.paymentLink, orderId).run();
  
  // Clear flow state
  await clearFlowState(phone, env);
  
  // Send payment link
  const message = `📦 Order Created!

Order ID: ${orderId}
Amount: ₹${total}

Click below to complete payment:`;
  
  await sendText(phone, message, env);
  await sendText(phone, paymentResult.paymentLink, env);
  
  const followUp = "Payment link expires in 24 hours. Once paid, we'll prepare your order immediately! 🚀";
  
  const buttons = [
    { id: 'pay_cod', title: '💵 Switch to COD' },
    { id: 'talk_support', title: '💬 Need Help?' },
  ];
  
  await sendButtons(phone, followUp, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// HANDLE INPUT IN FLOW
// ═════════════════════════════════════════════════════════════════

async function handleStepInput(phone, step, input, env) {
  switch (step) {
    case 'receive_name':
      return receiveName(phone, input.text, env);
    case 'receive_address':
      return receiveAddress(phone, input.text, env);
    case 'receive_city':
      return receiveCity(phone, input.text, env);
    case 'receive_pincode':
      return receivePincode(phone, input.text, env);
    default:
      // Unknown step, restart
      return startOrderFlow(phone, env);
  }
}

// ═════════════════════════════════════════════════════════════════
// HELPER
// ═════════════════════════════════════════════════════════════════

function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}