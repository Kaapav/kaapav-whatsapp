/**
 * ════════════════════════════════════════════════════════════════
 * PULL TO REFRESH
 * Native-like pull to refresh component
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { FiRefreshCw } from 'react-icons/fi';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const THRESHOLD = 80; // Pull distance to trigger refresh
const MAX_PULL = 120; // Maximum pull distance
const RESISTANCE = 2.5; // Pull resistance factor

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PullToRefresh({ children, onRefresh, isRefreshing }) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  
  // Motion values for smooth animations
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, THRESHOLD], [0, 180]);
  const scale = useTransform(y, [0, THRESHOLD / 2, THRESHOLD], [0.5, 0.8, 1]);
  const opacity = useTransform(y, [0, THRESHOLD / 2], [0, 1]);
  
  // Check if at top of scroll
  const isAtTop = () => {
    if (!containerRef.current) return true;
    return containerRef.current.scrollTop <= 0;
  };
  
  // Touch start handler
  const handleTouchStart = useCallback((e) => {
    if (!isAtTop()) return;
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);
  
  // Touch move handler
  const handleTouchMove = useCallback((e) => {
    if (!isPulling || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0 && isAtTop()) {
      // Apply resistance
      const distance = Math.min(diff / RESISTANCE, MAX_PULL);
      setPullDistance(distance);
      y.set(distance);
      
      // Prevent default scroll
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [isPulling, isRefreshing, y]);
  
  // Touch end handler
  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;
    
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      // Trigger refresh
      onRefresh?.();
      setPullDistance(THRESHOLD);
      y.set(THRESHOLD);
    } else {
      // Reset
      setPullDistance(0);
      y.set(0);
    }
    
    setIsPulling(false);
  }, [isPulling, pullDistance, isRefreshing, onRefresh, y]);
  
  // Reset when refresh completes
  if (!isRefreshing && pullDistance === THRESHOLD) {
    setTimeout(() => {
      setPullDistance(0);
      y.set(0);
    }, 300);
  }
  
  return (
    <div
      ref={containerRef}
      className="min-h-screen overflow-y-auto overscroll-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Indicator */}
      <motion.div
        style={{ height: pullDistance }}
        className="overflow-hidden flex items-center justify-center bg-dark"
      >
        <motion.div
          style={{ opacity, scale, rotate }}
          className="flex flex-col items-center"
        >
          <FiRefreshCw 
            size={24} 
            className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <motion.p 
            style={{ opacity }}
            className="text-xs text-gray-400 mt-2"
          >
            {isRefreshing 
              ? 'Refreshing...' 
              : pullDistance >= THRESHOLD 
                ? 'Release to refresh' 
                : 'Pull to refresh'
            }
          </motion.p>
        </motion.div>
      </motion.div>
      
      {/* Content */}
      <motion.div
        style={{ y: isPulling ? y : 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      >
        {children}
      </motion.div>
    </div>
  );
}