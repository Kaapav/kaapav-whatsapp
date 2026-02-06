/**
 * ════════════════════════════════════════════════════════════════
 * BUTTON HANDLER - KAAPAV LUXURY JEWELLERY
 * Complete routing with your exact menu structure + Cloudflare integration
 * ════════════════════════════════════════════════════════════════
 */

import { 
  sendMainMenu, 
  sendJewelleryCategoriesMenu,
  sendOffersAndMoreMenu,
  sendPaymentAndTrackMenu,
  sendChatWithUsCta,
  sendSocialMenu,
  sendSimpleInfo,
  LINKS 
} from '../services/whatsapp.js';

// ════════════════════════════════════════════════════════════════
// ID NORMALIZATION MAP (Your exact Render structure)
// ════════════════════════════════════════════════════════════════
const idMap = {
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

  // optional informational
  'show_list': 'SHOW_LIST',
};

// ════════════════════════════════════════════════════════════════
// KEYWORD ROUTING (Your exact Render patterns)
// ════════════════════════════════════════════════════════════════
const keywords = [
  // menus
  { re: /\b(browse|shop|website|site|collection|categories?)\b/i, action: 'JEWELLERY_MENU' },
  { re: /\b(offer|discount|deal|sale|bestsellers?)\b/i, action: 'OFFERS_MENU' },
  { re: /\b(payment|pay|upi|card|netbanking|debit|credit|payment\s*menu)\b/i, action: 'PAYMENT_MENU' },
  { re: /\b(chat|help|support|agent|talk|assist)\b/i, action: 'CHAT_MENU' },
  { re: /\b(back|main menu|menu|start|hi|hello|hey|namaste|vanakkam)\b/i, action: 'MAIN_MENU' },

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

// ════════════════════════════════════════════════════════════════
// NORMALIZE BUTTON ID (Your exact Render logic)
// ════════════════════════════════════════════════════════════════
function normalizeId(s) {
  const key = String(s || '').trim().toLowerCase();
  if (!key) return '';
  if (idMap[key]) return idMap[key];
  const alnum = key.replace(/[^a-z0-9_]/g, '');
  if (idMap[alnum]) return idMap[alnum];
  return '';
}

// ════════════════════════════════════════════════════════════════
// SESSION UPDATE HELPER (Cloudflare D1 + KV integration)
// ════════════════════════════════════════════════════════════════
async function updateSession(userId, updates, env) {
  try {
    // Update D1
    const sets = [];
    const params = [];

    if (updates.lastMenu) {
      // Store for analytics if needed
    }

    sets.push('last_seen = datetime("now")');
    sets.push('message_count = message_count + 1');
    sets.push('updated_at = datetime("now")');
    
    params.push(userId);

    if (sets.length > 0) {
      await env.DB.prepare(`
        UPDATE customers SET ${sets.join(', ')} WHERE phone = ?
      `).bind(...params).run();
    }

    // Clear KV cache
    await env.KV.delete(`session:${userId}`).catch(() => {});
  } catch (error) {
    console.warn('[Session] Update failed:', error.message);
  }
}

// ════════════════════════════════════════════════════════════════
// MAIN ROUTER (Your exact Render routing logic)
// ════════════════════════════════════════════════════════════════
async function routeAction(action, from, session, env) {
  const lang = session?.lang || 'en';
  
  console.log(`[KAAPAV ButtonHandler] Routing ${from} → ${action}`);
  
  try {
    switch (action) {
      // ─── MAIN MENUS ───
      case "MAIN_MENU":
        await sendMainMenu(from, env, lang);
        await updateSession(from, { lastMenu: "main" }, env);
        return true;

      case "JEWELLERY_MENU":
        await sendJewelleryCategoriesMenu(from, env, lang);
        await updateSession(from, { lastMenu: "jewellery" }, env);
        return true;

      case "OFFERS_MENU":
        await sendOffersAndMoreMenu(from, env, lang);
        await updateSession(from, { lastMenu: "offers" }, env);
        return true;

      case "PAYMENT_MENU":
        await sendPaymentAndTrackMenu(from, env, lang);
        await updateSession(from, { lastMenu: "payment_track" }, env);
        return true;

      case "CHAT_MENU":
        await sendChatWithUsCta(from, env, lang);
        await updateSession(from, { lastMenu: "chat" }, env);
        return true;

      case "SOCIAL_MENU":
        await sendSocialMenu(from, env, lang);
        await updateSession(from, { lastMenu: "social" }, env);
        return true;

      // ─── DIRECT ACTIONS ───
      case 'OPEN_WEBSITE':
        await sendSimpleInfo(from, `🌐 Visit KAAPAV:\n${LINKS.website}`, env);
        return true;

      case 'OPEN_CATALOG':
        await sendSimpleInfo(from, `📱 WhatsApp Catalogue:\n${LINKS.whatsappCatalog}`, env);
        return true;

      case 'OPEN_BESTSELLERS':
        await sendSimpleInfo(from, `🛍️ Bestsellers:\n${LINKS.offersBestsellers}`, env);
        return true;

      case 'PAY_NOW':
        await sendSimpleInfo(from, `💳 Payment Link:\n${LINKS.payment}\n\n✅ Secure via Razorpay`, env);
        return true;

      case 'TRACK_ORDER':
        await sendSimpleInfo(from, `📦 Track Your Order:\n${LINKS.shiprocket}\n\nEnter your AWB/Tracking ID on the Shiprocket website.`, env);
        return true;

      case 'CHAT_NOW':
        await sendSimpleInfo(from, `💬 Chat with us:\n${LINKS.waMeChat}`, env);
        return true;

      case 'OPEN_FACEBOOK':
        await sendSimpleInfo(from, `📘 Facebook:\n${LINKS.facebook}`, env);
        return true;

      case 'OPEN_INSTAGRAM':
        await sendSimpleInfo(from, `📸 Instagram:\n${LINKS.instagram}`, env);
        return true;

      case 'SHOW_LIST':
        await sendSimpleInfo(from, 
          "📜 Categories coming soon.\nMeanwhile explore:\n" + LINKS.website, 
          env
        );
        return true;

      default:
        console.warn(`[ButtonHandler] Unknown action: ${action}`);
        return false;
    }
  } catch (error) {
    console.error(`[ButtonHandler] Error routing ${action}:`, error.message);
    
    // Fallback message
    try {
      await sendSimpleInfo(from, 
        "⚠️ Something went wrong. Please try again or type 'menu' to start over.", 
        env
      );
    } catch {}
    
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// HANDLE BUTTON CLICK (Main entry point from webhook)
// ════════════════════════════════════════════════════════════════
export async function handleButtonClick(phone, payload, session, env) {
  if (!phone) {
    console.warn('[ButtonHandler] No phone provided');
    return false;
  }
  
  const raw = String(payload || '').trim();
  
  // Try normalize from idMap
  let action = normalizeId(raw);
  
  // If not mapped, try keyword match
  if (!action) {
    for (const k of keywords) {
      if (k.re.test(raw)) {
        action = k.action;
        break;
      }
    }
  }
  
  // Default to main menu
  if (!action) {
    console.log(`[ButtonHandler] No match for "${raw}", defaulting to MAIN_MENU`);
    action = 'MAIN_MENU';
  }
  
  return routeAction(action, phone, session, env);
}

// ════════════════════════════════════════════════════════════════
// HANDLE TEXT MESSAGE (Keyword routing)
// ════════════════════════════════════════════════════════════════
export async function handleTextMessage(phone, text, session, env) {
  if (!phone || !text) {
    console.warn('[ButtonHandler] Missing phone or text');
    return false;
  }
  
  console.log(`[ButtonHandler] Processing text from ${phone}: "${text}"`);
  
  // Check keywords
  let action = 'MAIN_MENU';
  
  for (const k of keywords) {
    if (k.re.test(text)) {
      action = k.action;
      console.log(`[ButtonHandler] Matched keyword pattern: ${k.re} → ${action}`);
      break;
    }
  }
  
  return routeAction(action, phone, session, env);
}

// ════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════
export { routeAction, normalizeId };
