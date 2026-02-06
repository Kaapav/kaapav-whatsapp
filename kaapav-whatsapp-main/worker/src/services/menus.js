// worker/src/services/menus.js
/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV Menu Service
 * Exact replica of your sendMessage.js menu functions
 * ═══════════════════════════════════════════════════════════════
 */

import { WhatsAppService } from './whatsapp';
import { getConfig } from '../config';

export class MenuService {
  constructor(env) {
    this.env = env;
    this.wa = new WhatsAppService(env);
    this.config = getConfig(env);
    this.links = this.config.links;
  }

  /**
   * MAIN MENU (same as your sendMainMenu)
   */
  async sendMainMenu(to, lang = 'en') {
    const body = "✨ Welcome to *KAAPAV Luxury Jewellery*! ✨\n\n" +
      "👑 Crafted Elegance • Timeless Sparkle 💎\n" +
      "Choose an option below 👇";

    const footer = "💖 Luxury Meets You, Only at KAAPAV";

    return this.wa.sendButtons(to, body, [
      { id: 'JEWELLERY_MENU', title: '💎 Jewellery' },
      { id: 'CHAT_MENU', title: '💬 Chat with Us!' },
      { id: 'OFFERS_MENU', title: '🎉 Offers & More' },
    ], footer);
  }

  /**
   * JEWELLERY MENU (same as your sendJewelleryCategoriesMenu)
   */
  async sendJewelleryMenu(to, lang = 'en') {
    const body = "💎 *Explore KAAPAV Collections* 💎\n\n" +
      "✨ Handcrafted designs, curated for royalty 👑";

    const footer = "🌐 kaapav.com | 📱 Catalogue";

    return this.wa.sendButtons(to, body, [
      { id: 'OPEN_WEBSITE', title: '🌐 Website' },
      { id: 'OPEN_CATALOG', title: '📱 Catalogue' },
      { id: 'MAIN_MENU', title: '🏠 Home' },
    ], footer);
  }

  /**
   * OFFERS MENU (same as your sendOffersAndMoreMenu)
   */
  async sendOffersMenu(to, lang = 'en') {
    const body = "💫 *Exclusive Luxury Offers!* 💫\n\n" +
      "🎉 Flat 50% OFF Select Styles ✨\n" +
      "🚚 Free Shipping Above ₹498/- 💝";

    const footer = "🛍️ KAAPAV Bestsellers";

    return this.wa.sendButtons(to, body, [
      { id: 'BESTSELLERS', title: '🛍️ Bestsellers' },
      { id: 'PAYMENT_MENU', title: '💳 Payment & Track' },
      { id: 'MAIN_MENU', title: '🏠 Home' },
    ], footer);
  }

  /**
   * PAYMENT & TRACK MENU (same as your sendPaymentAndTrackMenu)
   */
  async sendPaymentMenu(to, lang = 'en') {
    const body = "💎 *Complete Your Sparkle with KAAPAV* 💎\n\n" +
      "Choose a secure option:\n" +
      "1️⃣ 💳 Payment – UPI or Cards\n" +
      "2️⃣ 📦 Track Your Order – Shiprocket\n\n" +
      "🚫 No COD ❌";

    const footer = "👑 KAAPAV – Luxury, Seamless & Secure ✨";

    return this.wa.sendButtons(to, body, [
      { id: 'PAY_NOW', title: '💳 Payment' },
      { id: 'TRACK_ORDER', title: '📦 Track Order' },
      { id: 'MAIN_MENU', title: '🏠 Home' },
    ], footer);
  }

  /**
   * CHAT MENU (same as your sendChatWithUsCta)
   */
  async sendChatMenu(to, lang = 'en') {
    const body = "💬 *Need Help? We're Here for You!* 💬\n\n" +
      "Please describe your query below ⬇️\n" +
      "Our support team will assist you with luxury care 👑✨";

    const footer = "We are just a tap away 💖";

    return this.wa.sendButtons(to, body, [
      { id: 'CHAT_NOW', title: '💬 Chat Now' },
      { id: 'SOCIAL_MENU', title: '🌐 FB & Instagram' },
      { id: 'MAIN_MENU', title: '🏠 Home' },
    ], footer);
  }

  /**
   * SOCIAL MENU (same as your sendSocialMenu)
   */
  async sendSocialMenu(to, lang = 'en') {
    const body = "🌐 *Follow KAAPAV on Social Media* 🌐\n\n" +
      "Stay connected for luxury vibes 👑✨";

    const footer = "📲 Choose your platform below 👇";

    return this.wa.sendButtons(to, body, [
      { id: 'OPEN_FACEBOOK', title: '📘 Facebook' },
      { id: 'OPEN_INSTAGRAM', title: '📸 Instagram' },
      { id: 'MAIN_MENU', title: '🏠 Home' },
    ], footer);
  }

  /**
   * Send simple info/link (same as your sendSimpleInfo)
   */
  async sendSimpleInfo(to, text, lang = 'en') {
    return this.wa.sendText(to, text);
  }

  /**
   * Send link messages for each action
   */
  async sendLink(to, action) {
    const messages = {
      OPEN_WEBSITE: `🌐 *Visit Our Website*\n\n${this.links.website}`,
      OPEN_CATALOG: `📱 *WhatsApp Catalogue*\n\nBrowse all our products:\n${this.links.whatsappCatalog}`,
      OPEN_BESTSELLERS: `🛍️ *Shop Bestsellers*\n\nOur top picks for you:\n${this.links.offersBestsellers}`,
      PAY_NOW: `💳 *Complete Your Payment*\n\nPay via UPI/Card/Netbanking:\n${this.links.payment}`,
      TRACK_ORDER: `📦 *Track Your Order*\n\nEnter your Order ID/AWB:\n${this.links.shiprocket}`,
      CHAT_NOW: `💬 *Start a Conversation*\n\nYou're already chatting with us! 😊\nJust type your query and we'll respond.`,
      OPEN_FACEBOOK: `📘 *Follow us on Facebook*\n\n${this.links.facebook}`,
      OPEN_INSTAGRAM: `📸 *Follow us on Instagram*\n\n${this.links.instagram}`,
    };

    const text = messages[action] || `Please visit: ${this.links.website}`;
    return this.wa.sendText(to, text);
  }
}
