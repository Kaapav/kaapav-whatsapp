/**
 * ════════════════════════════════════════════════════════════════
 * WHATSAPP CLOUD API SERVICE
 * Complete WhatsApp Business API integration
 * ════════════════════════════════════════════════════════════════
 */

const API_VERSION = 'v18.0';
const BASE_URL = 'https://graph.facebook.com';

// ═════════════════════════════════════════════════════════════════
// CORE API FUNCTION
// ═════════════════════════════════════════════════════════════════

async function callWhatsAppAPI(endpoint, data, env, method = 'POST') {
  const url = `${BASE_URL}/${API_VERSION}/${env.WA_PHONE_ID}/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${env.WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('[WhatsApp API] Error:', result.error?.message || 'Unknown error');
      return {
        success: false,
        error: result.error?.message || 'API request failed',
        code: result.error?.code,
      };
    }
    
    return {
      success: true,
      messageId: result.messages?.[0]?.id,
      data: result,
    };
  } catch (error) {
    console.error('[WhatsApp API] Network error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ═════════════════════════════════════════════════════════════════
// SEND TEXT MESSAGE
// ═════════════════════════════════════════════════════════════════

export async function sendText(phone, text, env, previewUrl = false) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'text',
    text: {
      preview_url: previewUrl,
      body: text.slice(0, 4096),
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND BUTTONS (Interactive)
// ═════════════════════════════════════════════════════════════════

export async function sendButtons(phone, text, buttons, env, header = null, footer = null) {
  // WhatsApp allows max 3 buttons
  const formattedButtons = buttons.slice(0, 3).map(btn => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title.slice(0, 20),
    },
  }));
  
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: text.slice(0, 1024),
      },
      action: {
        buttons: formattedButtons,
      },
    },
  };
  
  // Add optional header
  if (header) {
    if (typeof header === 'string') {
      data.interactive.header = { type: 'text', text: header.slice(0, 60) };
    } else if (header.type === 'image') {
      data.interactive.header = { type: 'image', image: { link: header.url } };
    }
  }
  
  // Add optional footer
  if (footer) {
    data.interactive.footer = { text: footer.slice(0, 60) };
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND LIST MESSAGE
// ═════════════════════════════════════════════════════════════════

export async function sendList(phone, text, buttonText, sections, env, header = null, footer = null) {
  // Format sections
  const formattedSections = sections.slice(0, 10).map(section => ({
    title: section.title?.slice(0, 24),
    rows: section.rows.slice(0, 10).map(row => ({
      id: row.id,
      title: row.title?.slice(0, 24),
      description: row.description?.slice(0, 72),
    })),
  }));
  
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: text.slice(0, 1024),
      },
      action: {
        button: buttonText.slice(0, 20),
        sections: formattedSections,
      },
    },
  };
  
  if (header) {
    data.interactive.header = { type: 'text', text: header.slice(0, 60) };
  }
  
  if (footer) {
    data.interactive.footer = { text: footer.slice(0, 60) };
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND IMAGE
// ═════════════════════════════════════════════════════════════════

export async function sendImage(phone, imageUrl, caption, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'image',
    image: {
      link: imageUrl,
    },
  };
  
  if (caption) {
    data.image.caption = caption.slice(0, 1024);
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND VIDEO
// ═════════════════════════════════════════════════════════════════

export async function sendVideo(phone, videoUrl, caption, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'video',
    video: {
      link: videoUrl,
    },
  };
  
  if (caption) {
    data.video.caption = caption.slice(0, 1024);
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND DOCUMENT
// ═════════════════════════════════════════════════════════════════

export async function sendDocument(phone, documentUrl, filename, caption, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename || 'document',
    },
  };
  
  if (caption) {
    data.document.caption = caption.slice(0, 1024);
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND AUDIO
// ═════════════════════════════════════════════════════════════════

export async function sendAudio(phone, audioUrl, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'audio',
    audio: {
      link: audioUrl,
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND LOCATION
// ═════════════════════════════════════════════════════════════════

export async function sendLocation(phone, latitude, longitude, name, address, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'location',
    location: {
      latitude,
      longitude,
      name: name?.slice(0, 1000),
      address: address?.slice(0, 1000),
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND CONTACT
// ═════════════════════════════════════════════════════════════════

export async function sendContact(phone, contact, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'contacts',
    contacts: [{
      name: {
        formatted_name: contact.name,
        first_name: contact.firstName || contact.name,
        last_name: contact.lastName,
      },
      phones: [{
        phone: contact.phone,
        type: 'CELL',
      }],
    }],
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND TEMPLATE MESSAGE
// ═════════════════════════════════════════════════════════════════

export async function sendTemplate(phone, templateName, params, language, env, headerParams = null, buttonParams = null) {
  const components = [];
  
  // Header parameters (for media or text)
  if (headerParams) {
    if (headerParams.type === 'image') {
      components.push({
        type: 'header',
        parameters: [{
          type: 'image',
          image: { link: headerParams.url },
        }],
      });
    } else if (headerParams.type === 'document') {
      components.push({
        type: 'header',
        parameters: [{
          type: 'document',
          document: { link: headerParams.url, filename: headerParams.filename },
        }],
      });
    } else if (headerParams.type === 'video') {
      components.push({
        type: 'header',
        parameters: [{
          type: 'video',
          video: { link: headerParams.url },
        }],
      });
    } else if (Array.isArray(headerParams)) {
      components.push({
        type: 'header',
        parameters: headerParams.map(p => ({ type: 'text', text: String(p) })),
      });
    }
  }
  
  // Body parameters
  if (params && params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map(p => ({
        type: 'text',
        text: String(p),
      })),
    });
  }
  
  // Button parameters (for dynamic URLs)
  if (buttonParams && buttonParams.length > 0) {
    buttonParams.forEach((param, index) => {
      components.push({
        type: 'button',
        sub_type: 'url',
        index,
        parameters: [{
          type: 'text',
          text: String(param),
        }],
      });
    });
  }
  
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: language || 'en',
      },
    },
  };
  
  if (components.length > 0) {
    data.template.components = components;
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND CATALOG MESSAGE (Product List)
// ═════════════════════════════════════════════════════════════════

export async function sendCatalog(phone, bodyText, env, headerText = null, footerText = null) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'catalog_message',
      body: {
        text: bodyText.slice(0, 1024),
      },
      action: {
        name: 'catalog_message',
      },
    },
  };
  
  if (headerText) {
    data.interactive.header = { type: 'text', text: headerText.slice(0, 60) };
  }
  
  if (footerText) {
    data.interactive.footer = { text: footerText.slice(0, 60) };
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND PRODUCT MESSAGE (Single Product)
// ═════════════════════════════════════════════════════════════════

export async function sendProduct(phone, productId, bodyText, env, catalogId) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'product',
      body: {
        text: bodyText.slice(0, 1024),
      },
      action: {
        catalog_id: catalogId || env.WA_CATALOG_ID,
        product_retailer_id: productId,
      },
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND PRODUCT LIST (Multiple Products)
// ═════════════════════════════════════════════════════════════════

export async function sendProductList(phone, products, headerText, bodyText, env, catalogId) {
  // Group products into sections
  const sections = [{
    title: 'Products',
    product_items: products.slice(0, 30).map(p => ({
      product_retailer_id: p.sku || p.id,
    })),
  }];
  
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'product_list',
      header: {
        type: 'text',
        text: headerText.slice(0, 60),
      },
      body: {
        text: bodyText.slice(0, 1024),
      },
      action: {
        catalog_id: catalogId || env.WA_CATALOG_ID,
        sections,
      },
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND CTA URL BUTTON
// ═════════════════════════════════════════════════════════════════

export async function sendCTAButton(phone, bodyText, buttonText, url, env, headerText = null) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: {
        text: bodyText.slice(0, 1024),
      },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: buttonText.slice(0, 20),
          url: url,
        },
      },
    },
  };
  
  if (headerText) {
    data.interactive.header = { type: 'text', text: headerText.slice(0, 60) };
  }
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// SEND FLOW MESSAGE
// ═════════════════════════════════════════════════════════════════

export async function sendFlow(phone, flowId, flowToken, bodyText, buttonText, env, mode = 'published') {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: {
        text: bodyText.slice(0, 1024),
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: flowId,
          mode: mode,
          flow_cta: buttonText.slice(0, 20),
        },
      },
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// MARK MESSAGE AS READ
// ═════════════════════════════════════════════════════════════════

export async function markAsRead(messageId, env) {
  const data = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// REACT TO MESSAGE
// ═════════════════════════════════════════════════════════════════

export async function sendReaction(phone, messageId, emoji, env) {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatPhone(phone),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji, // e.g., "👍", "❤️", "😂"
    },
  };
  
  return callWhatsAppAPI('messages', data, env);
}

// ═════════════════════════════════════════════════════════════════
// DOWNLOAD MEDIA
// ═════════════════════════════════════════════════════════════════

export async function downloadMedia(mediaId, env) {
  try {
    // First, get the media URL
    const response = await fetch(`${BASE_URL}/${API_VERSION}/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${env.WA_TOKEN}`,
      },
    });
    
    const data = await response.json();
    
    if (!data.url) {
      return { success: false, error: 'Media URL not found' };
    }
    
    // Download the actual media
    const mediaResponse = await fetch(data.url, {
      headers: {
        'Authorization': `Bearer ${env.WA_TOKEN}`,
      },
    });
    
    if (!mediaResponse.ok) {
      return { success: false, error: 'Failed to download media' };
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer();
    
    return {
      success: true,
      data: mediaBuffer,
      mimeType: data.mime_type,
      fileSize: data.file_size,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═════════════════════════════════════════════════════════════════
// UPLOAD MEDIA
// ═════════════════════════════════════════════════════════════════

export async function uploadMedia(file, mimeType, env) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', mimeType);
    formData.append('messaging_product', 'whatsapp');
    
    const response = await fetch(`${BASE_URL}/${API_VERSION}/${env.WA_PHONE_ID}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WA_TOKEN}`,
      },
      body: formData,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error?.message };
    }
    
    return {
      success: true,
      mediaId: data.id,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═════════════════════════════════════════════════════════════════
// GET BUSINESS PROFILE
// ═════════════════════════════════════════════════════════════════

export async function getBusinessProfile(env) {
  const url = `${BASE_URL}/${API_VERSION}/${env.WA_PHONE_ID}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.WA_TOKEN}`,
      },
    });
    
    const data = await response.json();
    
    return {
      success: true,
      profile: data.data?.[0] || {},
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═════════════════════════════════════════════════════════════════
// UPDATE BUSINESS PROFILE
// ═════════════════════════════════════════════════════════════════

export async function updateBusinessProfile(profileData, env) {
  const data = {
    messaging_product: 'whatsapp',
    ...profileData,
  };
  
  return callWhatsAppAPI('whatsapp_business_profile', data, env);
}

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function formatPhone(phone) {
  // Remove all non-digits
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // Add country code if missing
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned; // India
  }
  
  return cleaned;
}

// ═════════════════════════════════════════════════════════════════
// TYPING INDICATOR (Simulated)
// ═════════════════════════════════════════════════════════════════

export async function sendTypingIndicator(phone, duration, env) {
  // WhatsApp doesn't have a native typing indicator API
  // This is a placeholder for potential future implementation
  // or for use with unofficial APIs
  console.log(`[WhatsApp] Typing indicator for ${phone} for ${duration}ms`);
  return { success: true };
}

// ═════════════════════════════════════════════════════════════════
// BATCH SEND (With rate limiting)
// ═════════════════════════════════════════════════════════════════

export async function batchSend(messages, env, ratePerSecond = 10) {
  const results = [];
  const delay = 1000 / ratePerSecond;
  
  for (const msg of messages) {
    let result;
    
    switch (msg.type) {
      case 'text':
        result = await sendText(msg.phone, msg.text, env);
        break;
      case 'buttons':
        result = await sendButtons(msg.phone, msg.text, msg.buttons, env);
        break;
      case 'template':
        result = await sendTemplate(msg.phone, msg.templateName, msg.params, msg.language, env);
        break;
      case 'image':
        result = await sendImage(msg.phone, msg.imageUrl, msg.caption, env);
        break;
      default:
        result = await sendText(msg.phone, msg.text, env);
    }
    
    results.push({ phone: msg.phone, ...result });
    
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  return results;
}