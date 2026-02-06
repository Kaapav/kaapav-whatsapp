// worker/src/services/menus.js
/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV Menu Service - LUXURY EDITION
 * Premium styling for high-end customer experience
 * ═══════════════════════════════════════════════════════════════
 */

import { WhatsAppService } from './whatsapp';
import { getConfig } from '../config';

export class MenuService {
  constructor(env) {
    this.env = env;
    this.wa = new WhatsAppService(env);
    this.config = getConfig(env);
    this.links = this.config.links || {};
  }

  async t(text, lang = 'en') {
    return text;
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN MENU
  // ═══════════════════════════════════════════════════════════════
  async sendMainMenu(phone, lang = 'en') {
    const body = await this.t(
`═══════════════════════════
   ✨ *KAAPAV Fashion Jewellery* ✨
 ═══════════════════════════

👑 Crafted for Royalty

💎 Timeless elegance
✨ Stunning designs
🎁 Perfect gifting

Select below 👇`,
      lang
    );

    const footer = await this.t("💖 Where Luxury Meets You", lang);

    const buttons = [
      { id: 'JEWELLERY_MENU', title: '💎 Jewellery' },
      { id: 'CHAT_MENU', title: '💬 Chat with Us' },
      { id: 'OFFERS_MENU', title: '🎁 Offers' },
    ];

    try {
      const result = await this.wa.sendButtons(phone, body, buttons, footer);
      return {
        messageId: result?.messages?.[0]?.id,
        body,
        buttons,
        footer,
        type: 'interactive'
      };
    } catch (error) {
      console.error('[Menu] sendMainMenu error:', error);
      return { messageId: null, body, buttons, type: 'interactive' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // JEWELLERY MENU
  // ═══════════════════════════════════════════════════════════════
  async sendJewelleryMenu(phone, lang = 'en') {
    const body = await this.t(
`═══════════════════════════
   💎 *Our Collections* 💎
═══════════════════════════

👑 Curated for You

✨ Handcrafted pieces
🎀 Gift-ready packaging
💝 Made with love

Explore now 👇`,
      lang
    );

    const footer = await this.t("🌐 kaapav.com", lang);

    const buttons = [
      { id: 'OPEN_WEBSITE', title: '🌐 Website' },
      { id: 'OPEN_CATALOG', title: '📱 Catalogue' },
      { id: 'MAIN_MENU', title: '🏠 Back' },
    ];

    try {
      const result = await this.wa.sendButtons(phone, body, buttons, footer);
      return {
        messageId: result?.messages?.[0]?.id,
        body,
        buttons,
        footer,
        type: 'interactive'
      };
    } catch (error) {
      console.error('[Menu] sendJewelleryMenu error:', error);
      return { messageId: null, body, buttons, type: 'interactive' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OFFERS MENU
  // ═══════════════════════════════════════════════════════════════
  async sendOffersMenu(phone, lang = 'en') {
    const body = await this.t(
`═══════════════════════════
   🎁 *Exclusive Offers* 🎁
═══════════════════════════

👑 Limited Time Only

🔥 Flat 50% OFF
🚚 Free shipping ₹498+
⚡ Hurry, grab yours!

Shop now 👇`,
      lang
    );

    const footer = await this.t("✨ Don't miss out!", lang);

    const buttons = [
      { id: 'OPEN_BESTSELLERS', title: '🛍️ Bestsellers' },
      { id: 'PAYMENT_MENU', title: '💳 Pay & Track' },
      { id: 'MAIN_MENU', title: '🏠 Back' },
    ];

    try {
      const result = await this.wa.sendButtons(phone, body, buttons, footer);
      return {
        messageId: result?.messages?.[0]?.id,
        body,
        buttons,
        footer,
        type: 'interactive'
      };
    } catch (error) {
      console.error('[Menu] sendOffersMenu error:', error);
      return { messageId: null, body, buttons, type: 'interactive' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PAYMENT MENU
  // ═══════════════════════════════════════════════════════════════
  async sendPaymentMenu(phone, lang = 'en') {
    const body = await this.t(
`═══════════════════════════
   💳 *Payment & Tracking* 💳
═══════════════════════════

👑 Secure & Easy

🏦 UPI / Cards / Netbanking
✅ Instant confirmation
📦 Track your order

⚠️ COD not available

Choose below 👇`,
      lang
    );

    const footer = await this.t("🔒 100% Secure", lang);

    const buttons = [
      { id: 'PAY_NOW', title: '💳 Pay Now' },
      { id: 'TRACK_ORDER', title: '📦 Track Order' },
      { id: 'MAIN_MENU', title: '🏠 Back' },
    ];

    try {
      const result = await this.wa.sendButtons(phone, body, buttons, footer);
      return {
        messageId: result?.messages?.[0]?.id,
        body,
        buttons,
        footer,
        type: 'interactive'
      };
    } catch (error) {
      console.error('[Menu] sendPaymentMenu error:', error);
      return { messageId: null, body, buttons, type: 'interactive' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHAT MENU
  // ═══════════════════════════════════════════════════════════════
  async sendChatMenu(phone, lang = 'en') {
    const body = await this.t(
`═══════════════════════════
   💬 *We're Here to Help* 💬
═══════════════════════════

👑 Personal Assistance

👗 Styling advice
📋 Order support
⚡ Quick response

How can we help? 👇`,
      lang
    );

    const footer = await this.t("💝 At your service", lang);

    const buttons = [
      { id: 'CHAT_NOW', title: '💬 Chat Now' },
      { id: 'SOCIAL_MENU', title: '📱 Follow Us' },
      { id: 'MAIN_MENU', title: '🏠 Back' },
    ];

    try {
      const result = await this.wa.sendButtons(phone, body, buttons, footer);
      return {
        messageId: result?.messages?.[0]?.id,
        body,
        buttons,
        footer,
        type: 'interactive'
      };
    } catch (error) {
      console.error('[Menu] sendChatMenu error:', error);
      return { messageId: null, body, buttons, type: 'interactive' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SOCIAL MENU
  // ═══════════════════════════════════════════════════════════════
  async sendSocialMenu(phone, lang = 'en') {
    const body = await this.t(
`═══════════════════════════
   📱 *Join Our World* 📱
═══════════════════════════

👑 Stay Connected

🆕 New launches
🎁 Exclusive offers
💕 Behind the scenes

Follow us 👇`,
      lang
    );

    const footer = await this.t("✨ Be part of KAAPAV", lang);

    const buttons = [
      { id: 'OPEN_FACEBOOK', title: '👍 Facebook' },
      { id: 'OPEN_INSTAGRAM', title: '📷 Instagram' },
      { id: 'MAIN_MENU', title: '🏠 Back' },
    ];

    try {
      const result = await this.wa.sendButtons(phone, body, buttons, footer);
      return {
        messageId: result?.messages?.[0]?.id,
        body,
        buttons,
        footer,
        type: 'interactive'
      };
    } catch (error) {
      console.error('[Menu] sendSocialMenu error:', error);
      return { messageId: null, body, buttons, type: 'interactive' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LINK SENDER - LUXURY FORMAT
  // ═══════════════════════════════════════════════════════════════
  async sendLink(phone, action, lang = 'en') {
    const linkMessages = {
      'OPEN_WEBSITE': {
        emoji: '🌐',
        title: 'Visit Our Website',
        tagline: 'Complete Collection',
        points: [
          '💎 Latest arrivals',
          '🛍️ Exclusive designs',
          '✨ Easy shopping'
        ],
        cta: 'Explore now',
        url: this.links.website || 'https://www.kaapav.com'
      },
      'OPEN_CATALOG': {
        emoji: '📱',
        title: 'WhatsApp Catalogue',
        tagline: 'Quick Browse & Order',
        points: [
          '👆 Tap to view',
          '💝 Easy selection',
          '🛒 Instant order'
        ],
        cta: 'Browse now',
        url: this.links.whatsappCatalog || 'https://wa.me/c/919148330016'
      },
      'OPEN_BESTSELLERS': {
        emoji: '🛍️',
        title: 'Bestselling Pieces',
        tagline: 'Customer Favorites',
        points: [
          '❤️ Most loved designs',
          '🔥 Trending now',
          '⚡ Limited stock!'
        ],
        cta: 'Shop now',
        url: this.links.offersBestsellers || 'https://www.kaapav.com'
      },
      'PAY_NOW': {
        emoji: '💳',
        title: 'Secure Payment',
        tagline: '100% Safe Checkout',
        points: [
          '🏦 UPI / Cards / Netbanking',
          '✅ Instant confirmation',
          '🔒 Secure & trusted'
        ],
        cta: 'Pay now',
        url: this.links.payment || 'https://razorpay.me/@kaapav'
      },
      'TRACK_ORDER': {
        emoji: '📦',
        title: 'Track Your Order',
        tagline: 'Real-Time Updates',
        points: [
          '📍 Live tracking',
          '🚚 Delivery status',
          '⏰ ETA updates'
        ],
        cta: 'Track here',
        url: this.links.shiprocket || 'https://www.shiprocket.in/shipment-tracking/'
      },
      'CHAT_NOW': {
        emoji: '💬',
        title: 'Chat With Us',
        tagline: 'Personal Assistance',
        points: [
          '👗 Styling advice',
          '📋 Order help',
          '⚡ Quick response'
        ],
        cta: 'Chat now',
        url: this.links.waMeChat || 'https://wa.me/919148330016'
      },
      'OPEN_FACEBOOK': {
        emoji: '👍',
        title: 'Follow on Facebook',
        tagline: 'Join Our Community',
        points: [
          '🆕 New launches',
          '🎁 Exclusive offers',
          '📸 Behind the scenes'
        ],
        cta: 'Follow us',
        url: this.links.facebook || 'https://www.facebook.com/kaapavfashionjewellery/'
      },
      'OPEN_INSTAGRAM': {
        emoji: '📷',
        title: 'Follow on Instagram',
        tagline: 'Daily Inspiration',
        points: [
          '💅 Styling tips',
          '✨ New arrivals',
          '💕 Customer stories'
        ],
        cta: 'Follow us',
        url: this.links.instagram || 'https://www.instagram.com/kaapavfashionjewellery/'
      },
    };

    const link = linkMessages[action];
    if (!link) {
      console.warn(`Unknown link action: ${action}`);
      return this.sendMainMenu(phone, lang);
    }

    const message = 
`═══════════════════════════
${link.emoji} *${link.title}*
═══════════════════════════

👑 ${link.tagline}

${link.points[0]}
${link.points[1]}
${link.points[2]}

${link.cta}:
${link.url}

═══════════════════════════
💎 KAAPAV Fashion Jewellery`;

    try {
      const result = await this.wa.sendText(phone, message);
      return {
        messageId: result?.messages?.[0]?.id,
        body: message,
        buttons: null,
        type: 'text'
      };
    } catch (error) {
      console.error('[Menu] sendLink error:', error);
      return { messageId: null, body: message, buttons: null, type: 'text' };
    }
  }
}

export default MenuService;