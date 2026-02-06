// worker/src/config.js
/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV Configuration - Matching your sendMessage.js LINKS
 * ═══════════════════════════════════════════════════════════════
 */

export function getConfig(env) {
  return {
    // WhatsApp API
    graphApiVersion: env.GRAPH_API_VERSION || 'v18.0',
    whatsappPhoneId: env.WHATSAPP_PHONE_ID,
    whatsappToken: env.WHATSAPP_TOKEN,
    whatsappVerifyToken: env.WHATSAPP_VERIFY_TOKEN,
    whatsappCatalogId: env.WHATSAPP_CATALOG_ID,

    // Links (same as your LINKS object)
    links: {
      website: env.WEBSITE_URL || 'https://www.kaapav.com',
      whatsappCatalog: env.CATALOG_URL || 'https://wa.me/c/919148330016',
      waMeChat: env.WAME_CHAT_URL || 'https://wa.me/919148330016',
      offersBestsellers: env.BESTSELLERS_URL || 'https://www.kaapav.com/shop/category/all-jewellery-12?category=12&search=&order=&tags=16',
      payment: env.PAYMENT_URL || 'https://razorpay.me/@kaapav',
      shiprocket: env.TRACKING_URL || 'https://www.shiprocket.in/shipment-tracking/',
      facebook: env.FACEBOOK_URL || 'https://www.facebook.com/kaapavfashionjewellery/',
      instagram: env.INSTAGRAM_URL || 'https://www.instagram.com/kaapavfashionjewellery/',
    },

    // Rate limiting
    rateLimitMs: 900,
    
    // App
    appUrl: env.APP_URL || 'https://app.kaapav.com',
  };
}

// ID Map (same as your buttonHandler.js idMap)
export const ID_MAP = {
  // main/back
  'main_menu': 'MAIN_MENU',
  'back': 'MAIN_MENU',
  'back_main': 'MAIN_MENU',
  'back_main_menu': 'MAIN_MENU',
  'home': 'MAIN_MENU',
  'start': 'MAIN_MENU',

  // top-level menus
  'jewellery_menu': 'JEWELLERY_MENU',
  'offers_menu': 'OFFERS_MENU',
  'payment_menu': 'PAYMENT_MENU',
  'chat_menu': 'CHAT_MENU',
  'social_menu': 'SOCIAL_MENU',

  // submenu links / actions
  'open_website': 'OPEN_WEBSITE',
  'open_catalog': 'OPEN_CATALOG',
  'open_bestsellers': 'OPEN_BESTSELLERS',
  'bestsellers': 'OPEN_BESTSELLERS',
  'payment_track': 'PAYMENT_MENU',
  'pay_now': 'PAY_NOW',
  'track_order': 'TRACK_ORDER',
  'chat_now': 'CHAT_NOW',
  'open_facebook': 'OPEN_FACEBOOK',
  'open_instagram': 'OPEN_INSTAGRAM',
  'show_list': 'SHOW_LIST',
};

// Keywords (same as your buttonHandler.js keywords)
export const KEYWORDS = [
  // menus
  { re: /\b(browse|shop|website|site|collection|categories?)\b/i, action: 'JEWELLERY_MENU' },
  { re: /\b(offer|discount|deal|sale|bestsellers?)\b/i, action: 'OFFERS_MENU' },
  { re: /\b(payment|pay|upi|card|netbanking|debit|credit|payment\s*menu)\b/i, action: 'PAYMENT_MENU' },
  { re: /\b(chat|help|support|agent|talk|assist)\b/i, action: 'CHAT_MENU' },
  { re: /\b(back|main\s*menu|menu|start|hi|hello|hey|namaste|vanakkam)\b/i, action: 'MAIN_MENU' },

  // direct CTAs
  { re: /\b(best(?:seller)?s?|trending|top\s*picks?)\b/i, action: 'OPEN_BESTSELLERS' },
  { re: /\b(list|category\s*list|full\s*list)\b/i, action: 'SHOW_LIST' },
  { re: /\b(website|shop\s*now)\b/i, action: 'OPEN_WEBSITE' },
  { re: /\b(catalog|catalogue|whatsapp\s*catalog)\b/i, action: 'OPEN_CATALOG' },
  { re: /\b(track|tracking|order\s*status|where\s*.*order)\b/i, action: 'TRACK_ORDER' },

  // socials
  { re: /\b(facebook|fb)\b/i, action: 'OPEN_FACEBOOK' },
  { re: /\b(insta|instagram)\b/i, action: 'OPEN_INSTAGRAM' },
  { re: /\b(social|follow|media)\b/i, action: 'SOCIAL_MENU' },
];
