/**
 * ═══════════════════════════════════════════════════════════════
 * PULL TO REFRESH - Mobile Pull-to-Refresh Component
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useRef } from 'react';

function PullToRefresh({ children, onRefresh, isRefreshing = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const threshold = 80;

  const handleTouchStart = (e) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      setPullDistance(Math.min(diff * 0.5, threshold + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      await onRefresh?.();
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            transition: isPulling ? 'none' : 'all 0.3s',
            opacity: isRefreshing ? 1 : pullDistance / threshold,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--gold)',
              borderTopColor: 'transparent',
              animation: isRefreshing || pullDistance >= threshold ? 'spin 0.8s linear infinite' : 'none',
              transform: `rotate(${(pullDistance / threshold) * 360}deg)`,
            }}
          />
        </div>
      )}

      {children}
    </div>
  );
}

export default PullToRefresh;
