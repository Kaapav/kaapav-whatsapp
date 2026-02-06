// worker/src/handlers/template.js
export class Template {
  static async list(c) {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM templates ORDER BY created_at DESC
    `).all();
    
    return c.json({ templates: results });
  }
  
  static async create(c) {
    const data = await c.body();
    
    await c.env.DB.prepare(`
      INSERT INTO templates (name, wa_template_name, language, category, header_type, header_content, body_text, footer_text, buttons, variables, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      data.name,
      data.wa_template_name,
      data.language || 'en',
      data.category || 'utility',
      data.header_type,
      data.header_content,
      data.body_text,
      data.footer_text,
      JSON.stringify(data.buttons || []),
      JSON.stringify(data.variables || []),
      new Date().toISOString()
    ).run();
    
    return c.json({ success: true });
  }
  
  static async quickReplies(c) {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM quick_replies ORDER BY use_count DESC
    `).all();
    
    return c.json({ quick_replies: results });
  }
  
  static async createQuickReply(c) {
    const data = await c.body();
    
    await c.env.DB.prepare(`
      INSERT INTO quick_replies (shortcut, title, content, category, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(data.shortcut, data.title, data.content, data.category || 'general', new Date().toISOString()).run();
    
    return c.json({ success: true });
  }
  
  static async deleteQuickReply(c) {
    await c.env.DB.prepare('DELETE FROM quick_replies WHERE id = ?').bind(c.params.id).run();
    return c.json({ success: true });
  }
  
  static async autoResponders(c) {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM auto_responders ORDER BY priority DESC
    `).all();
    
    return c.json({ auto_responders: results });
  }
  
  static async createAutoResponder(c) {
    const data = await c.body();
    
    await c.env.DB.prepare(`
      INSERT INTO auto_responders (name, trigger_type, trigger_value, response_type, response_content, is_active, priority, conditions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.name,
      data.trigger_type,
      data.trigger_value,
      data.response_type,
      JSON.stringify(data.response_content),
      data.is_active ? 1 : 0,
      data.priority || 0,
      JSON.stringify(data.conditions || {}),
      new Date().toISOString()
    ).run();
    
    return c.json({ success: true });
  }
  
  static async updateAutoResponder(c) {
    const data = await c.body();
    const fields = [];
    const values = [];
    
    const allowed = ['name', 'trigger_type', 'trigger_value', 'response_type', 'response_content', 'is_active', 'priority', 'conditions'];
    
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        if (['response_content', 'conditions'].includes(key)) {
          values.push(JSON.stringify(value));
        } else if (key === 'is_active') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }
    
    if (fields.length === 0) return c.error('No valid fields', 400);
    
    values.push(c.params.id);
    await c.env.DB.prepare(`UPDATE auto_responders SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    
    return c.json({ success: true });
  }
}
