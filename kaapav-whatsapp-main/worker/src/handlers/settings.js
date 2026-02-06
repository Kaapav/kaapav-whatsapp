// worker/src/handlers/settings.js
export class Settings {
  static async get(c) {
    const { results } = await c.env.DB.prepare('SELECT * FROM settings').all();
    
    const settings = {};
    for (const row of results) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    
    // Add env-based settings (read-only)
    settings._env = {
      hasWhatsApp: !!c.env.WHATSAPP_TOKEN,
      hasRazorpay: !!c.env.RAZORPAY_KEY_ID,
      hasShiprocket: !!c.env.SHIPROCKET_EMAIL,
      hasCatalog: !!c.env.WHATSAPP_CATALOG_ID,
    };
    
    return c.json({ settings });
  }
  
  static async update(c) {
    const data = await c.body();
    
    for (const [key, value] of Object.entries(data)) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      await c.env.DB.prepare(`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
      `).bind(key, valueStr, new Date().toISOString(), valueStr, new Date().toISOString()).run();
    }
    
    return c.json({ success: true });
  }
  
  static async testWhatsApp(c) {
    const { phone } = await c.body();
    
    if (!phone) return c.error('Phone number required', 400);
    
    try {
      const { WhatsAppService } = await import('../services/whatsapp.js');
      const wa = new WhatsAppService(c.env);
      
      await wa.sendText(phone, '✅ KAAPAV WhatsApp API test successful!\n\nYour integration is working correctly.');
      
      return c.json({ success: true, message: 'Test message sent' });
    } catch (err) {
      return c.error('WhatsApp test failed: ' + err.message, 500);
    }
  }
}
