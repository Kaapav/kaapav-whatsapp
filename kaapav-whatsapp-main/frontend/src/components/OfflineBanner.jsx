/**
 * ═══════════════════════════════════════════════════════════════
 * OFFLINE BANNER - Shows when user is offline
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';

function OfflineBanner() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'var(--warning)',
        color: 'var(--white)',
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 500,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <i className="fas fa-wifi-slash"></i>
      You're offline. Some features may not work.
    </div>
  );
}

export default OfflineBanner;
