/**
 * ═══════════════════════════════════════════════════════════════
 * TOAST - Notification Toast Component
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';

function Toast({ message, type = 'default' }) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'fa-check-circle';
      case 'error':
        return 'fa-exclamation-circle';
      case 'warning':
        return 'fa-exclamation-triangle';
      default:
        return 'fa-info-circle';
    }
  };

  return (
    <div className={`toast show ${type}`}>
      <i className={`fas ${getIcon()}`}></i>
      <span>{message}</span>
    </div>
  );
}

export default Toast;
