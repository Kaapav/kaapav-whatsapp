/**
 * ════════════════════════════════════════════════════════════════
 * CRON JOB HANDLER
 * Scheduled tasks orchestrator
 * ════════════════════════════════════════════════════════════════
 */

import { processCartRecovery } from './cartRecovery.js';
import { processOrderReminders } from './orderReminders.js';
import { processScheduledCampaigns, continueActiveBroadcasts } from './campaigns.js';

// ═════════════════════════════════════════════════════════════════
// MAIN CRON HANDLER
// ═════════════════════════════════════════════════════════════════

export async function handleCron(event, env) {
  const startTime = Date.now();
  console.log(`[Cron] Starting scheduled tasks at ${new Date().toISOString()}`);
  
  const results = {
    cartRecovery: { success: false, processed: 0 },
    orderReminders: { success: false, processed: 0 },
    campaigns: { success: false, processed: 0 },
    broadcasts: { success: false, processed: 0 },
  };
  
  try {
    // ─────────────────────────────────────────────────────────────
    // 1. ABANDONED CART RECOVERY
    // ─────────────────────────────────────────────────────────────
    try {
      results.cartRecovery = await processCartRecovery(env);
      console.log(`[Cron] Cart Recovery: ${results.cartRecovery.processed} processed`);
    } catch (error) {
      console.error('[Cron] Cart Recovery Error:', error.message);
      results.cartRecovery.error = error.message;
    }
    
    // ─────────────────────────────────────────────────────────────
    // 2. ORDER/PAYMENT REMINDERS
    // ─────────────────────────────────────────────────────────────
    try {
      results.orderReminders = await processOrderReminders(env);
      console.log(`[Cron] Order Reminders: ${results.orderReminders.processed} processed`);
    } catch (error) {
      console.error('[Cron] Order Reminders Error:', error.message);
      results.orderReminders.error = error.message;
    }
    
    // ─────────────────────────────────────────────────────────────
    // 3. SCHEDULED CAMPAIGNS
    // ─────────────────────────────────────────────────────────────
    try {
      results.campaigns = await processScheduledCampaigns(env);
      console.log(`[Cron] Scheduled Campaigns: ${results.campaigns.processed} started`);
    } catch (error) {
      console.error('[Cron] Campaigns Error:', error.message);
      results.campaigns.error = error.message;
    }
    
    // ─────────────────────────────────────────────────────────────
    // 4. CONTINUE ACTIVE BROADCASTS
    // ─────────────────────────────────────────────────────────────
    try {
      results.broadcasts = await continueActiveBroadcasts(env);
      console.log(`[Cron] Active Broadcasts: ${results.broadcasts.processed} continued`);
    } catch (error) {
      console.error('[Cron] Broadcasts Error:', error.message);
      results.broadcasts.error = error.message;
    }
    
    // ─────────────────────────────────────────────────────────────
    // 5. CLEANUP OLD DATA
    // ─────────────────────────────────────────────────────────────
    try {
      await cleanupOldData(env);
    } catch (error) {
      console.error('[Cron] Cleanup Error:', error.message);
    }
    
  } catch (error) {
    console.error('[Cron] Fatal Error:', error.message);
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Cron] Completed in ${duration}ms`, results);
  
  // Log cron execution
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, data, created_at)
    VALUES ('system', 'cron_execution', ?, datetime('now'))
  `).bind(JSON.stringify({ results, duration })).run().catch(() => {});
}

// ═════════════════════════════════════════════════════════════════
// CLEANUP OLD DATA
// ═════════════════════════════════════════════════════════════════

async function cleanupOldData(env) {
  // Clean expired sessions
  await env.DB.prepare(`
    DELETE FROM sessions WHERE expires_at < datetime('now')
  `).run();
  
  // Clean expired conversation states
  await env.DB.prepare(`
    DELETE FROM conversation_state WHERE expires_at < datetime('now')
  `).run();
  
  // Clean old analytics (keep 90 days)
  await env.DB.prepare(`
    DELETE FROM analytics WHERE created_at < datetime('now', '-90 days')
  `).run();
  
  // Clean old automation logs (keep 30 days)
  await env.DB.prepare(`
    DELETE FROM automation_log WHERE created_at < datetime('now', '-30 days')
  `).run();
  
  // Clean old broadcast recipients (keep 60 days)
  await env.DB.prepare(`
    DELETE FROM broadcast_recipients 
    WHERE broadcast_id IN (
      SELECT broadcast_id FROM broadcasts 
      WHERE completed_at < datetime('now', '-60 days')
    )
  `).run();
  
  console.log('[Cron] Cleanup completed');
}