/**
 * ═══════════════════════════════════════════════════════════════
 * QUICK REPLIES - Horizontal Scrollable Reply Buttons
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';

function QuickReplies({ replies = [], onSelect }) {
  if (!replies?.length) return null;

  return (
    <div className="quick-replies-bar">
      {replies.map((reply, index) => (
        <button
          key={index}
          className="quick-reply"
          onClick={() => onSelect?.(reply)}
        >
          {typeof reply === 'string' ? reply : reply.title || reply.shortcut}
        </button>
      ))}
    </div>
  );
}

export default QuickReplies;
