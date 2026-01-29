/**
 * ════════════════════════════════════════════════════════════════
 * SETTINGS SCREEN
 * App settings and user profile
 * ════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiUser, FiLock, FiBell, FiMoon, FiLogOut,
  FiChevronRight, FiShield, FiHelpCircle, FiInfo
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

// ═══════════════════════════════════════════════════════════════
// SETTINGS ITEM
// ═══════════════════════════════════════════════════════════════

function SettingsItem({ icon: Icon, label, description, onClick, rightElement, danger }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 hover:bg-dark-200 rounded-xl transition-colors ${danger ? 'text-danger' : 'text-white'}`}
    >
      <div className={`w-10 h-10 rounded-xl ${danger ? 'bg-danger/20' : 'bg-dark-200'} flex items-center justify-center`}>
        <Icon size={20} className={danger ? 'text-danger' : 'text-gray-400'} />
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      {rightElement || <FiChevronRight className="text-gray-500" />}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOGGLE SWITCH
// ═══════════════════════════════════════════════════════════════

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-dark-300'}`}
    >
      <motion.div
        animate={{ x: enabled ? 22 : 2 }}
        className="w-5 h-5 bg-white rounded-full shadow"
      />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  
  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
      navigate('/login', { replace: true });
    }
  };
  
  const handleChangePassword = () => {
    toast.success('Password change coming soon');
  };
  
  return (
    <div className="min-h-screen bg-dark safe-top pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>
      
      {/* Profile Card */}
      <div className="px-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-2xl font-bold text-black">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{user?.name || 'User'}</h2>
            <p className="text-gray-400">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary/20 text-primary rounded-full text-xs">
              {user?.role || 'Agent'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Settings Groups */}
      <div className="px-4 space-y-6">
        {/* Account */}
        <div>
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-2 px-4">Account</h3>
          <div className="card p-0 overflow-hidden">
            <SettingsItem
              icon={FiUser}
              label="Edit Profile"
              description="Name, avatar, email"
              onClick={() => toast.success('Coming soon')}
            />
            <SettingsItem
              icon={FiLock}
              label="Change Password"
              description="Update your password"
              onClick={handleChangePassword}
            />
            <SettingsItem
              icon={FiShield}
              label="Two-Factor Auth"
              description="Add extra security"
              onClick={() => toast.success('Coming soon')}
            />
          </div>
        </div>
        
        {/* Preferences */}
        <div>
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-2 px-4">Preferences</h3>
          <div className="card p-0 overflow-hidden">
            <SettingsItem
              icon={FiBell}
              label="Push Notifications"
              description="Receive alerts for new messages"
              rightElement={<Toggle enabled={notifications} onChange={setNotifications} />}
            />
            <SettingsItem
              icon={FiMoon}
              label="Dark Mode"
              description="Always on"
              rightElement={<Toggle enabled={darkMode} onChange={setDarkMode} />}
            />
          </div>
        </div>
        
        {/* Support */}
        <div>
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-2 px-4">Support</h3>
          <div className="card p-0 overflow-hidden">
            <SettingsItem
              icon={FiHelpCircle}
              label="Help Center"
              description="FAQs and guides"
              onClick={() => toast.success('Coming soon')}
            />
            <SettingsItem
              icon={FiInfo}
              label="About"
              description="Version 1.0.0"
              onClick={() => toast.success('KAAPAV Dashboard v1.0.0')}
            />
          </div>
        </div>
        
        {/* Logout */}
        <div className="card p-0 overflow-hidden">
          <SettingsItem
            icon={FiLogOut}
            label="Logout"
            description="Sign out of your account"
            onClick={handleLogout}
            danger
          />
        </div>
      </div>
    </div>
  );
}