/**
 * ════════════════════════════════════════════════════════════════
 * CAMPAIGN SCHEDULER
 * Scheduled broadcasts and active campaign processor
 * ════════════════════════════════════════════════════════════════
 */

import { sendText, sendButtons, sendTemplate, sendImage } from '../services/whatsapp.js';

// ═════════════════════════════════════════════════════════════════
// PROCESS SCHEDULED CAMPAIGNS
// ═════════════════════════════════════════════════════════════════

export async function processScheduledCampaigns(env) {
  const results = { success: true, processed: 0, started: 0 };
  
  // Get campaigns scheduled for now
  const { results: campaigns } = await env.DB.prepare(`
    SELECT * FROM broadcasts
    WHERE status = 'scheduled'
    AND scheduled_at <= datetime('now')
    LIMIT 5
  `).all();
  
  for (const campaign of campaigns || []) {
    try {
      results.processed++;
      
      // Get target recipients
      const recipients = await getTargetRecipients(campaign, env);
      
      if (recipients.length === 0) {
        await env.DB.prepare(`
          UPDATE broadcasts SET status = 'failed', completed_at = datetime('now')
          WHERE broadcast_id = ?
        `).bind(campaign.broadcast_id).run();
        continue;
      }
      
      // Insert recipients
      for (const phone of recipients) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO broadcast_recipients (broadcast_id, phone, status)
          VALUES (?, ?, 'pending')
        `).bind(campaign.broadcast_id, phone).run();
      }
      
      // Update campaign to sending
      await env.DB.prepare(`
        UPDATE broadcasts SET 
          status = 'sending',
          target_count = ?,
          started_at = datetime('now')
        WHERE broadcast_id = ?
      `).bind(recipients.length, campaign.broadcast_id).run();
      
      results.started++;
      
      console.log(`[Campaigns] Started ${campaign.broadcast_id} with ${recipients.length} recipients`);
      
    } catch (error) {
      console.error(`[Campaigns] Error starting ${campaign.broadcast_id}:`, error.message);
    }
  }
  
  return results;
}

// ═════════════════════════════════════════════════════════════════
// CONTINUE ACTIVE BROADCASTS
// ═════════════════════════════════════════════════════════════════

export async function continueActiveBroadcasts(env) {
  const results = { success: true, processed: 0, sent: 0, failed: 0, completed: 0 };
  
  // Get active broadcasts
  const { results: broadcasts } = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE status = 'sending' LIMIT 3
  `).all();
  
  for (const broadcast of broadcasts || []) {
    try {
      const sendRate = broadcast.send_rate || 30;
      const batchSize = Math.min(50, Math.ceil(sendRate * 5 / 60)); // 5 minutes worth
      
      // Get pending recipients
      const { results: recipients } = await env.DB.prepare(`
        SELECT phone FROM broadcast_recipients
        WHERE broadcast_id = ? AND status = 'pending'
        LIMIT ?
      `).bind(broadcast.broadcast_id, batchSize).all();
      
      if (!recipients?.length) {
        // Mark as completed
        await env.DB.prepare(`
          UPDATE broadcasts SET 
            status = 'completed',
            completed_at = datetime('now')
          WHERE broadcast_id = ?
        `).bind(broadcast.broadcast_id).run();
        
        results.completed++;
        continue;
      }
      
      results.processed++;
      
      const delayMs = Math.ceil(60000 / sendRate);
      
      for (const recipient of recipients) {
        try {
          const sendResult = await sendBroadcastMessage(recipient.phone, broadcast, env);
          
          if (sendResult.success) {
            await env.DB.prepare(`
              UPDATE broadcast_recipients SET 
                status = 'sent',
                message_id = ?,
                sent_at = datetime('now')
              WHERE broadcast_id = ? AND phone = ?
            `).bind(sendResult.messageId, broadcast.broadcast_id, recipient.phone).run();
            
            results.sent++;
          } else {
            throw new Error(sendResult.error);
          }
          
        } catch (error) {
          await env.DB.prepare(`
            UPDATE broadcast_recipients SET 
              status = 'failed',
              error_message = ?,
              failed_at = datetime('now')
            WHERE broadcast_id = ? AND phone = ?
          `).bind(error.message?.slice(0, 500), broadcast.broadcast_id, recipient.phone).run();
          
          results.failed++;
        }
        
        await sleep(delayMs);
      }
      
      // Update broadcast counts
      await env.DB.prepare(`
        UPDATE broadcasts SET 
          sent_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ? AND status = 'sent'),
          failed_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ? AND status = 'failed')
        WHERE broadcast_id = ?
      `).bind(broadcast.broadcast_id, broadcast.broadcast_id, broadcast.broadcast_id).run();
      
    } catch (error) {
      console.error(`[Campaigns] Error processing ${broadcast.broadcast_id}:`, error.message);
    }
  }
  
  return results;
}

// ═════════════════════════════════════════════════════════════════
// SEND BROADCAST MESSAGE
// ═════════════════════════════════════════════════════════════════

async function sendBroadcastMessage(phone, broadcast, env) {
  switch (broadcast.message_type) {
    case 'template':
      return await sendTemplate(
        phone,
        broadcast.template_name,
        safeJsonParse(broadcast.template_params, []),
        'en',
        env
      );
      
    case 'image':
      if (broadcast.media_url) {
        return await sendImage(phone, broadcast.media_url, broadcast.message, env);
      }
      return await sendText(phone, broadcast.message, env);
      
    case 'buttons':
      const buttons = safeJsonParse(broadcast.buttons, []);
      if (buttons.length > 0) {
        return await sendButtons(phone, broadcast.message, buttons, env);
      }
      return await sendText(phone, broadcast.message, env);
      
    case 'text':
    default:
      return await sendText(phone, broadcast.message, env);
  }
}

// ═════════════════════════════════════════════════════════════════
// GET TARGET RECIPIENTS
// ═════════════════════════════════════════════════════════════════

async function getTargetRecipients(campaign, env) {
  let query = `SELECT phone FROM customers WHERE opted_in = 1`;
  const params = [];
  
  const targetLabels = safeJsonParse(campaign.target_labels, []);
  const targetFilters = safeJsonParse(campaign.target_filters, {});
  
  switch (campaign.target_type) {
    case 'all':
      // No additional filters
      break;
      
    case 'labels':
      if (targetLabels.length > 0) {
        const labelConditions = targetLabels.map(() => `labels LIKE ?`).join(' OR ');
        query += ` AND (${labelConditions})`;
        params.push(...targetLabels.map(l => `%"${l}"%`));
      }
      break;
      
    case 'segment':
      if (campaign.target_segment) {
        query += ` AND segment = ?`;
        params.push(campaign.target_segment);
      }
      break;
      
    case 'tier':
      if (targetFilters.tier) {
        query += ` AND tier = ?`;
        params.push(targetFilters.tier);
      }
      break;
      
    case 'custom':
      if (targetFilters.minOrders) {
        query += ` AND order_count >= ?`;
        params.push(targetFilters.minOrders);
      }
      if (targetFilters.maxOrders) {
        query += ` AND order_count <= ?`;
        params.push(targetFilters.maxOrders);
      }
      if (targetFilters.minSpent) {
        query += ` AND total_spent >= ?`;
        params.push(targetFilters.minSpent);
      }
      if (targetFilters.lastActiveDays) {
        query += ` AND last_seen >= datetime('now', '-' || ? || ' days')`;
        params.push(targetFilters.lastActiveDays);
      }
      break;
  }
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results?.map(r => r.phone) || [];
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function safeJsonParse(str, defaultValue = null) {
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}