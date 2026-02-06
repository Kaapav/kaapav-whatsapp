// worker/src/handlers/media.js
export class Media {
  static async upload(c) {
    try {
      const formData = await c.request.formData();
      const file = formData.get('file');
      
      if (!file) return c.error('No file provided', 400);
      
      const buffer = await file.arrayBuffer();
      const filename = file.name || `upload_${Date.now()}`;
      const mimeType = file.type || 'application/octet-stream';
      const key = `uploads/${Date.now()}_${filename}`;
      
      // Upload to R2
      await c.env.R2.put(key, buffer, {
        httpMetadata: { contentType: mimeType },
        customMetadata: { originalName: filename, uploadedBy: c.user?.email || 'unknown' },
      });
      
      // Save to DB
      await c.env.DB.prepare(`
        INSERT INTO media (key, filename, mime_type, size, uploaded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(key, filename, mimeType, buffer.byteLength, c.user?.email || 'system', new Date().toISOString()).run();
      
      // Get public URL
      const publicUrl = `https://${c.env.R2_PUBLIC_DOMAIN || 'r2.kaapav.com'}/${key}`;
      
      return c.json({
        success: true,
        key,
        url: publicUrl,
        filename,
        size: buffer.byteLength,
      });
    } catch (err) {
      console.error('Upload error:', err);
      return c.error('Upload failed: ' + err.message, 500);
    }
  }
  
  static async get(c) {
    const key = c.params.id;
    const object = await c.env.R2.get(key);
    
    if (!object) return c.error('Media not found', 404);
    
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000');
    
    return new Response(object.body, { headers });
  }
  
  static async delete(c) {
    const key = c.params.id;
    
    await c.env.R2.delete(key);
    await c.env.DB.prepare('DELETE FROM media WHERE key = ?').bind(key).run();
    
    return c.json({ success: true });
  }
  
  static async list(c) {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM media ORDER BY created_at DESC LIMIT 100
    `).all();
    
    return c.json({ media: results });
  }
}
