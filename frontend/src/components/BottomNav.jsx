/**
 * ════════════════════════════════════════════════════════════════
 * BOTTOM NAVIGATION
 * Mobile-first bottom navigation bar
 * ════════════════════════════════════════════════════════════════
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiHome, FiMessageCircle, FiShoppingBag, 
  FiPackage, FiSettings, FiUsers, FiSend
} from 'react-icons/fi';
import { useChatStore, useOrderStore } from '../store';

// ═══════════════════════════════════════════════════════════════
// NAV ITEMS CONFIG
// ═══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { path: '/', icon: FiHome, label: 'Home' },
  { path: '/chats', icon: FiMessageCircle, label: 'Chats', badge: 'unread' },
  { path: '/orders', icon: FiShoppingBag, label: 'Orders', badge: 'pending' },
  { path: '/products', icon: FiPackage, label: 'Products' },
  { path: '/settings', icon: FiSettings, label: 'Settings' },
];

// ═══════════════════════════════════════════════════════════════
// NAV ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════

function NavItem({ item, isActive, badge, onClick }) {
  const Icon = item.icon;
  
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center flex-1 py-2 relative"
    >
      {/* Badge */}
      {badge > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1 right-1/4 min-w-[18px] h-[18px] bg-danger rounded-full text-[10px] font-bold flex items-center justify-center text-white px-1"
        >
          {badge > 99 ? '99+' : badge}
        </motion.span>
      )}
      
      {/* Icon */}
      <motion.div
        animate={{ 
          scale: isActive ? 1.1 : 1,
          y: isActive ? -2 : 0
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <Icon 
          size={24} 
          className={isActive ? 'text-primary' : 'text-gray-500'} 
          strokeWidth={isActive ? 2.5 : 2}
        />
      </motion.div>
      
      {/* Label */}
      <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-primary' : 'text-gray-500'}`}>
        {item.label}
      </span>
      
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN BOTTOM NAV
// ═══════════════════════════════════════════════════════════════

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { unreadCount } = useChatStore();
  const { stats } = useOrderStore();
  
  // Get badge count based on type
  const getBadge = (badgeType) => {
    switch (badgeType) {
      case 'unread':
        return unreadCount || 0;
      case 'pending':
        return stats?.stats?.byStatus?.pending || 0;
      default:
        return 0;
    }
  };
  
  // Check if current path matches
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };
  
  // Don't show on chat window
  if (location.pathname.match(/^\/chats\/\d+$/)) {
    return null;
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-dark/95 backdrop-blur-lg border-t border-dark-200 safe-bottom">
      <div className="flex items-center max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            isActive={isActive(item.path)}
            badge={item.badge ? getBadge(item.badge) : 0}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>
    </nav>
  );
}