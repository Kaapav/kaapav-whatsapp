// worker/src/handlers/customer.js
export class Customer {
  static async list(c) {
    const limit = parseInt(c.query('limit') || '50');
    const offset = parseInt(c.query('offset') || '0');
    const search = c.query('search') || '';

    let sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM orders WHERE phone = c.phone) as order_count,
        (SELECT SUM(total) FROM orders WHERE phone = c.phone AND payment_status = 'paid') as total_spent
      FROM customers c
    `;
    const params = [];

    if (search) {
      sql += ` WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(sql).bind(...params).all();
    const total = await c.env.DB.prepare('SELECT COUNT(*) as n FROM customers').first();

    return c.json({ customers: results, total: total?.n || 0 });
  }

  static async stats(c) {
    const [total, active, newToday, newWeek] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as n FROM customers').first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM customers WHERE last_message_at > datetime('now', '-7 days')`).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM customers WHERE DATE(created_at) = DATE('now')`).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM customers WHERE created_at > datetime('now', '-7 days')`).first(),
    ]);

    return c.json({
      total: total?.n || 0,
      activeThisWeek: active?.n || 0,
      newToday: newToday?.n || 0,
      newThisWeek: newWeek?.n || 0,
    });
  }

  static async get(c) {
    const customer = await c.env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM orders WHERE phone = c.phone) as order_count,
        (SELECT SUM(total) FROM orders WHERE phone = c.phone AND payment_status = 'paid') as total_spent,
        (SELECT MAX(created_at) FROM orders WHERE phone = c.phone) as last_order_at
      FROM customers c WHERE c.phone = ?
    `).bind(c.params.phone).first();

    if (!customer) return c.error('Customer not found', 404);

    // Get recent orders
    const { results: orders } = await c.env.DB.prepare(`
      SELECT order_id, total, status, payment_status, created_at 
      FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 5
    `).bind(c.params.phone).all();

    // Parse notes
    customer.notes = JSON.parse(customer.notes || '[]');
    customer.labels = JSON.parse(customer.labels || '[]');
    customer.recent_orders = orders;

    return c.json({ customer });
  }

  static async update(c) {
    const data = await c.body();
    const allowed = ['name', 'email', 'address', 'city', 'state', 'pincode', 'labels', 'is_blocked', 'is_starred'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(key === 'labels' ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return c.error('No valid fields', 400);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString(), c.params.phone);

    await c.env.DB.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE phone = ?`).bind(...values).run();

    return c.json({ success: true });
  }

  static async addNote(c) {
    const { note } = await c.body();
    const customer = await c.env.DB.prepare('SELECT notes FROM customers WHERE phone = ?').bind(c.params.phone).first();
    
    if (!customer) return c.error('Customer not found', 404);

    const notes = JSON.parse(customer.notes || '[]');
    notes.push({
      text: note,
      by: c.user?.email || 'system',
      at: new Date().toISOString(),
    });

    await c.env.DB.prepare('UPDATE customers SET notes = ?, updated_at = ? WHERE phone = ?')
      .bind(JSON.stringify(notes), new Date().toISOString(), c.params.phone).run();

    return c.json({ success: true, notes });
  }

  static async orders(c) {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC
    `).bind(c.params.phone).all();

    return c.json({ orders: results });
  }
}
