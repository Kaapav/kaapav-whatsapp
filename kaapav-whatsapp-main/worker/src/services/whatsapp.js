// worker/src/services/whatsapp.js
/**
 * ═══════════════════════════════════════════════════════════════
 * WhatsApp Cloud API Service
 * Equivalent to your sendMessage.js
 * ═══════════════════════════════════════════════════════════════
 */

import { getConfig } from '../config';

export class WhatsAppService {
  constructor(env) {
    this.env = env;
    this.config = getConfig(env);
    this.baseUrl = `https://graph.facebook.com/${this.config.graphApiVersion}`;
    this.phoneId = this.config.whatsappPhoneId;
    this.token = this.config.whatsappToken;
  }

  // Normalize Indian phone numbers (same as your normalizeIN)
  normalizePhone(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    if (digits.startsWith('91')) return digits;
    if (digits.startsWith('0')) return `91${digits.slice(1)}`;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  /**
   * Core API request (same as your sendAPIRequest)
   */
  async sendAPIRequest(payload) {
    console.log('[WhatsApp API] Sending:', {
      to: payload?.to,
      type: payload?.type,
    });

    if (!this.token || !this.phoneId) {
      console.error('[WhatsApp API] Missing credentials');
      throw new Error('WhatsApp credentials not configured');
    }

    const url = `${this.baseUrl}/${this.phoneId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[WhatsApp API] Error:', data);
        throw new Error(data.error?.message || `API error: ${response.status}`);
      }

      console.log('[WhatsApp API] Success:', data.messages?.[0]?.id);
      return data;

    } catch (error) {
      console.error('[WhatsApp API] Request failed:', error);
      throw error;
    }
  }

  /**
   * Send text message (same as your sendText)
   */
  async sendText(to, text) {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'text',
      text: { body: text },
    });
  }

  /**
   * Send reply buttons (same as your sendReplyButtons)
   * Max 3 buttons, 20 chars per title
   */
  async sendButtons(to, bodyText, buttons, footer = null) {
    const normalizedTo = this.normalizePhone(to);
    
    if (!buttons || !buttons.length) {
      return this.sendText(normalizedTo, bodyText);
    }

    // WhatsApp allows max 3 buttons
    const waButtons = buttons.slice(0, 3).map(b => ({
      type: 'reply',
      reply: {
        id: String(b.id).slice(0, 256),
        title: String(b.title).slice(0, 20),
      },
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: waButtons },
      },
    };

    if (footer) {
      payload.interactive.footer = { text: footer };
    }

    return this.sendAPIRequest(payload);
  }

  /**
   * Send list message (same concept as interactive list)
   * Max 10 sections, 10 rows per section
   */
  async sendList(to, bodyText, buttonText, sections, header = null, footer = null) {
    const payload = {
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText.slice(0, 20),
          sections: sections.map(section => ({
            title: section.title?.slice(0, 24),
            rows: section.rows.slice(0, 10).map(row => ({
              id: row.id?.slice(0, 200),
              title: row.title?.slice(0, 24),
              description: row.description?.slice(0, 72),
            })),
          })),
        },
      },
    };

    if (header) {
      payload.interactive.header = { type: 'text', text: header };
    }

    if (footer) {
      payload.interactive.footer = { text: footer };
    }

    return this.sendAPIRequest(payload);
  }

  /**
   * Send CTA URL button (your sendCtaUrl)
   */
  async sendCtaUrl(to, bodyText, displayText, url, footer = null) {
    // WhatsApp Cloud API doesn't support URL buttons in interactive
    // So we send as text with the link
    const message = `${bodyText}\n\n${displayText}: ${url}`;
    return this.sendText(to, message);
  }

  /**
   * Send image
   */
  async sendImage(to, imageUrl, caption = null) {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption,
      },
    });
  }

  /**
   * Send document
   */
  async sendDocument(to, documentUrl, filename, caption = null) {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
        caption: caption,
      },
    });
  }

  /**
   * Send template message
   */
  async sendTemplate(to, templateName, components = [], language = 'en') {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components,
      },
    });
  }

  /**
   * Send template with text parameters
   */
  async sendTemplateWithParams(to, templateName, params = [], language = 'en') {
    const components = [];
    
    if (params.length > 0) {
      components.push({
        type: 'body',
        parameters: params.map(p => ({
          type: 'text',
          text: String(p),
        })),
      });
    }

    return this.sendTemplate(to, templateName, components, language);
  }

  /**
   * Send product from catalog
   */
  async sendProduct(to, catalogId, productRetailerId) {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: 'Check out this product!' },
        action: {
          catalog_id: catalogId,
          product_retailer_id: productRetailerId,
        },
      },
    });
  }

  /**
   * Send product list
   */
  async sendProductList(to, catalogId, products, headerText, bodyText) {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      to: this.normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: { type: 'text', text: headerText },
        body: { text: bodyText },
        action: {
          catalog_id: catalogId,
          sections: [{
            title: 'Products',
            product_items: products.slice(0, 30).map(p => ({
              product_retailer_id: p.sku || p.id,
            })),
          }],
        },
      },
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId) {
    return this.sendAPIRequest({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Get media URL
   */
  async getMediaUrl(mediaId) {
    const response = await fetch(`${this.baseUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await response.json();
    return data.url;
  }
}
