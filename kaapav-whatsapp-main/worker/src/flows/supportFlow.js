/**
 * ════════════════════════════════════════════════════════════════
 * SUPPORT FLOW
 * Customer support and FAQ handling
 * ════════════════════════════════════════════════════════════════
 */

import { sendText, sendButtons, sendList } from '../services/whatsapp.js';

// ═════════════════════════════════════════════════════════════════
// MAIN SUPPORT MENU
// ═════════════════════════════════════════════════════════════════

export async function showSupportMenu(phone, env) {
  const message = "💬 *How can we help?*\n\nChoose from the options below or type your question.";
  
  const sections = [
    {
      title: 'Orders & Shipping',
      rows: [
        { id: 'faq_track', title: '📦 Track My Order', description: 'Check order status' },
        { id: 'faq_cancel', title: '❌ Cancel Order', description: 'Cancel a pending order' },
        { id: 'faq_shipping', title: '🚚 Shipping Info', description: 'Delivery times & areas' },
        { id: 'faq_cod', title: '💵 COD Availability', description: 'Cash on delivery info' },
      ],
    },
    {
      title: 'Returns & Payments',
      rows: [
        { id: 'faq_return', title: '🔄 Return Policy', description: 'How to return items' },
        { id: 'faq_refund', title: '💰 Refund Status', description: 'Check refund status' },
        { id: 'faq_payment', title: '💳 Payment Issues', description: 'Payment problems' },
      ],
    },
    {
      title: 'Other',
      rows: [
        { id: 'faq_bulk', title: '📦 Bulk Orders', description: 'Wholesale inquiries' },
        { id: 'talk_agent', title: '👤 Talk to Agent', description: 'Chat with our team' },
      ],
    },
  ];
  
  await sendList(phone, message, 'Get Help', sections, env);
}

// ═════════════════════════════════════════════════════════════════
// FAQ HANDLERS
// ═════════════════════════════════════════════════════════════════

export async function handleFAQ(phone, faqId, env) {
  switch (faqId) {
    case 'faq_track':
      return showOrderTracking(phone, env);
      
    case 'faq_cancel':
      return showCancelInfo(phone, env);
      
    case 'faq_shipping':
      return showShippingInfo(phone, env);
      
    case 'faq_cod':
      return showCODInfo(phone, env);
      
    case 'faq_return':
      return showReturnPolicy(phone, env);
      
    case 'faq_refund':
      return showRefundStatus(phone, env);
      
    case 'faq_payment':
      return showPaymentHelp(phone, env);
      
    case 'faq_bulk':
      return showBulkInfo(phone, env);
      
    case 'talk_agent':
      return connectToAgent(phone, env);
      
    default:
      return showSupportMenu(phone, env);
  }
}

// ═════════════════════════════════════════════════════════════════
// TRACK ORDER
// ═════════════════════════════════════════════════════════════════

async function showOrderTracking(phone, env) {
  // Get recent orders
  const { results: orders } = await env.DB.prepare(`
    SELECT order_id, status, tracking_id, courier, created_at
    FROM orders
    WHERE phone = ? AND status NOT IN ('delivered', 'cancelled')
    ORDER BY created_at DESC
    LIMIT 3
  `).bind(phone).all();
  
  if (!orders?.length) {
    const message = "You don't have any active orders.\n\nWould you like to browse our collection?";
    const buttons = [
      { id: 'shop_now', title: '🛍️ Shop Now' },
      { id: 'my_orders', title: '📜 Order History' },
    ];
    await sendButtons(phone, message, buttons, env);
    return;
  }
  
  let message = "📦 *Your Active Orders*\n\n";
  
  const statusEmoji = {
    pending: '🟡 Pending',
    confirmed: '🟢 Confirmed',
    processing: '🔵 Processing',
    shipped: '🚚 Shipped',
  };
  
  orders.forEach(order => {
    message += `*${order.order_id}*\n`;
    message += `Status: ${statusEmoji[order.status] || order.status}\n`;
    if (order.tracking_id) {
      message += `Tracking: ${order.tracking_id}\n`;
    }
    message += `\n`;
  });
  
  const buttons = [
    { id: `order_track_${orders[0].order_id}`, title: '📍 Track Latest' },
    { id: 'talk_support', title: '💬 Need Help?' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// CANCEL ORDER INFO
// ═════════════════════════════════════════════════════════════════

async function showCancelInfo(phone, env) {
  // Get cancellable orders
  const { results: orders } = await env.DB.prepare(`
    SELECT order_id, total, status
    FROM orders
    WHERE phone = ? AND status IN ('pending', 'confirmed')
    ORDER BY created_at DESC
    LIMIT 3
  `).bind(phone).all();
  
  if (!orders?.length) {
    const message = "❌ *Order Cancellation*\n\nYou don't have any orders that can be cancelled.\n\nOrders can only be cancelled before shipping.";
    await sendText(phone, message, env);
    return;
  }
  
  let message = "❌ *Cancel Order*\n\nSelect an order to cancel:\n\n";
  
  const buttons = orders.slice(0, 3).map(order => ({
    id: `cancel_${order.order_id}`,
    title: `❌ ${order.order_id}`,
  }));
  
  orders.forEach(order => {
    message += `*${order.order_id}* - ₹${order.total}\n`;
    message += `Status: ${order.status}\n\n`;
  });
  
  message += "⚠️ Cancelled orders will be refunded within 5-7 days.";
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// SHIPPING INFO
// ═════════════════════════════════════════════════════════════════

async function showShippingInfo(phone, env) {
  const message = `🚚 *Shipping Information*

📦 *Delivery Time*
• Metro cities: 2-4 days
• Other cities: 4-7 days
• Remote areas: 7-10 days

💰 *Shipping Charges*
• FREE on orders above ₹499
• ₹60 for orders below ₹499

🌍 *We Deliver*
All serviceable pincodes in India

📍 *Track Your Order*
You'll receive tracking details via WhatsApp once shipped.

Need to check if we deliver to your area?`;

  const buttons = [
    { id: 'check_pincode', title: '📍 Check Pincode' },
    { id: 'shop_now', title: '🛍️ Shop Now' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// COD INFO
// ═════════════════════════════════════════════════════════════════

async function showCODInfo(phone, env) {
  const message = `💵 *Cash on Delivery*

✅ COD is available!

📋 *Terms*
• Minimum order: ₹199
• Maximum order: ₹10,000
• COD charges: ₹40

🏙️ *Available in*
Most cities across India. Check serviceability with your pincode.

💡 *Tip*
Pay online to avoid COD charges and get faster delivery!`;

  const buttons = [
    { id: 'shop_now', title: '🛍️ Shop Now' },
    { id: 'check_pincode', title: '📍 Check Pincode' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// RETURN POLICY
// ═════════════════════════════════════════════════════════════════

async function showReturnPolicy(phone, env) {
  const message = `🔄 *Return Policy*

We want you to love your purchase!

📅 *Return Window*
7 days from delivery

✅ *Eligible for Return*
• Wrong item received
• Damaged/defective items
• Quality issues

❌ *Not Eligible*
• Used or altered items
• Without original packaging
• After 7 days

📦 *How to Return*
1. Contact us within 7 days
2. Share order ID and photos
3. We'll arrange free pickup
4. Refund in 5-7 days

Need to return an item?`;

  const buttons = [
    { id: 'start_return', title: '🔄 Start Return' },
    { id: 'talk_support', title: '💬 Talk to Us' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// REFUND STATUS
// ═════════════════════════════════════════════════════════════════

async function showRefundStatus(phone, env) {
  // Check for refunded payments
  const { results: refunds } = await env.DB.prepare(`
    SELECT p.*, o.order_id
    FROM payments p
    JOIN orders o ON p.order_id = o.order_id
    WHERE o.phone = ? AND p.refund_amount > 0
    ORDER BY p.refunded_at DESC
    LIMIT 3
  `).bind(phone).all();
  
  if (!refunds?.length) {
    const message = "💰 *Refund Status*\n\nNo refunds found for your account.\n\nIf you're expecting a refund, it may take 5-7 business days to process.";
    
    const buttons = [
      { id: 'talk_support', title: '💬 Contact Support' },
    ];
    
    await sendButtons(phone, message, buttons, env);
    return;
  }
  
  let message = "💰 *Your Refunds*\n\n";
  
  refunds.forEach(refund => {
    message += `*Order: ${refund.order_id}*\n`;
    message += `Amount: ₹${refund.refund_amount}\n`;
    message += `Status: ${refund.status === 'refunded' ? '✅ Completed' : '⏳ Processing'}\n`;
    if (refund.refunded_at) {
      message += `Date: ${new Date(refund.refunded_at).toLocaleDateString('en-IN')}\n`;
    }
    message += `\n`;
  });
  
  message += "Refunds are credited to original payment method within 5-7 business days.";
  
  await sendText(phone, message, env);
}

// ═════════════════════════════════════════════════════════════════
// PAYMENT HELP
// ═════════════════════════════════════════════════════════════════

async function showPaymentHelp(phone, env) {
  const message = `💳 *Payment Help*

🔒 *Secure Payments*
All transactions are 100% secure.

💰 *Payment Options*
• UPI (GPay, PhonePe, Paytm)
• Credit/Debit Cards
• Net Banking
• Wallets
• Cash on Delivery

❓ *Common Issues*

*Payment failed but money deducted?*
Don't worry! It will be auto-refunded in 5-7 days.

*Payment link expired?*
We'll send you a new one.

*OTP not received?*
Check SMS inbox or try a different payment method.

Need help with a specific payment?`;

  const buttons = [
    { id: 'get_payment_link', title: '🔗 New Payment Link' },
    { id: 'talk_support', title: '💬 Talk to Us' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// BULK ORDER INFO
// ═════════════════════════════════════════════════════════════════

async function showBulkInfo(phone, env) {
  const message = `📦 *Bulk & Wholesale Orders*

Looking to buy in bulk? We've got you covered!

💎 *Bulk Benefits*
• Special wholesale prices
• Dedicated support
• Faster processing
• Custom packaging

📋 *Minimum Order*
50+ pieces per design

📞 *Get Started*
Share your requirements and our team will get back with a custom quote.

Interested in bulk ordering?`;

  const buttons = [
    { id: 'bulk_inquiry', title: '📝 Send Inquiry' },
    { id: 'talk_support', title: '💬 Talk to Sales' },
  ];
  
  await sendButtons(phone, message, buttons, env);
}

// ═════════════════════════════════════════════════════════════════
// CONNECT TO AGENT
// ═════════════════════════════════════════════════════════════════

async function connectToAgent(phone, env) {
  // Update chat to require human attention
  await env.DB.prepare(`
    UPDATE chats SET
      is_bot_enabled = 0,
      status = 'pending',
      priority = 'high',
      updated_at = datetime('now')
    WHERE phone = ?
  `).bind(phone).run();
  
  const message = `👋 Connecting you to our team...

Our support hours:
🕐 Mon-Sat: 10 AM - 7 PM

We'll respond as soon as possible!

In the meantime, you can share:
• Your query or concern
• Order ID (if applicable)
• Screenshots (if needed)`;

  await sendText(phone, message, env);
  
  // Log
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, created_at)
    VALUES ('support', 'agent_requested', ?, datetime('now'))
  `).bind(phone).run().catch(() => {});
  
  // TODO: Send push notification to agents
}