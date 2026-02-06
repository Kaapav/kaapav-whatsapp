/**
 * ═══════════════════════════════════════════════════════════════
 * LOADING SCREEN - Full Screen Loading
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';

function LoadingScreen({ overlay = false }) {
  if (overlay) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="screen" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--white)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="login-logo" style={{ margin: '0 auto 20px' }}>
          <i className="fab fa-whatsapp"></i>
        </div>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
      </div>
    </div>
  );
}

export default LoadingScreen;
