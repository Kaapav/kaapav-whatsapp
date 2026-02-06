/**
 * ═══════════════════════════════════════════════════════════════
 * SETTINGS SCREEN - Complete Settings Management
 * Profile, Business, Notifications, Biometric, Integrations
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useSettingsStore, useUIStore } from '../store';
import { settingsAPI, authAPI } from '../api';
import { getInitials } from '../utils/helpers';
import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  getBiometricType,
  registerBiometric,
} from '../utils/biometric';

function Settings() {
  const navigate = useNavigate();

  // Store
  const { user, logout, biometricEnabled, enableBiometric, disableBiometric } = useAuthStore();
  const {
    pushEnabled,
    soundEnabled,
    emailDigestEnabled,
    aiAutoReply,
    keyboardShortcuts,
    toggleSetting,
  } = useSettingsStore();
  const { showToast } = useUIStore();

  // Local state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState({ name: 'Biometric', icon: 'fa-fingerprint' });
  const [isSettingUpBiometric, setIsSettingUpBiometric] = useState(false);

  // Check biometric availability
  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const available = await isPlatformAuthenticatorAvailable();
    setBiometricAvailable(available);
    if (available) {
      setBiometricType(getBiometricType());
    }
  };

  // Handle biometric toggle
  const handleBiometricToggle = async () => {
    if (biometricEnabled) {
      // Disable biometric
      disableBiometric();
      showToast(`${biometricType.name} disabled`, 'success');
    } else {
      // Enable biometric
      setIsSettingUpBiometric(true);
      try {
        // Get challenge from server
        const challengeResponse = await authAPI.biometricChallenge();
        
        // Register biometric
        const credential = await registerBiometric(
          user.userId,
          user.email,
          challengeResponse.challenge
        );

        // Save to server
        await authAPI.biometricRegister(credential);
        
        // Enable locally
        enableBiometric(credential.id);
        
        showToast(`${biometricType.name} enabled! 🔐`, 'success');
      } catch (err) {
        console.error('Biometric setup failed:', err);
        showToast(err.message || 'Failed to set up biometric', 'error');
      } finally {
        setIsSettingUpBiometric(false);
      }
    }
  };

  // Handle logout
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      showToast('Logged out successfully', 'success');
      navigate('/login');
    }
  };

  // Settings sections
  const settingsSections = [
    {
      title: 'Business',
      items: [
        {
          icon: 'fa-store',
          label: 'Business Profile',
          desc: 'Name, address, category',
          onClick: () => navigate('/settings/business'),
        },
        {
          icon: 'fa-th-large',
          label: 'Product Catalog',
          desc: `${user?.productCount || 0} products listed`,
          onClick: () => navigate('/products'),
        },
        {
          icon: 'fa-credit-card',
          label: 'Payment Settings',
          desc: 'Razorpay integration',
          onClick: () => navigate('/settings/payments'),
        },
        {
          icon: 'fa-truck',
          label: 'Shipping Settings',
          desc: 'Shiprocket integration',
          onClick: () => navigate('/settings/shipping'),
        },
      ],
    },
    {
      title: 'Chat Settings',
      items: [
        {
          icon: 'fa-robot',
          label: 'AI Auto-Reply',
          desc: 'Automated responses',
          toggle: 'aiAutoReply',
          value: aiAutoReply,
        },
        {
          icon: 'fa-comment-dots',
          label: 'Quick Replies',
          desc: 'Manage templates',
          onClick: () => navigate('/settings/quick-replies'),
        },
        {
          icon: 'fa-clock',
          label: 'Business Hours',
          desc: 'Set availability',
          onClick: () => navigate('/settings/hours'),
        },
        {
          icon: 'fa-tags',
          label: 'Labels',
          desc: 'Organize conversations',
          onClick: () => navigate('/settings/labels'),
        },
        {
          icon: 'fa-keyboard',
          label: 'Keyboard Shortcuts',
          desc: 'Power user features',
          toggle: 'keyboardShortcuts',
          value: keyboardShortcuts,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        ...(biometricAvailable
          ? [
              {
                icon: biometricType.icon,
                label: biometricType.name,
                desc: biometricEnabled ? 'Enabled for quick login' : 'Enable for faster login',
                toggle: 'biometric',
                value: biometricEnabled,
                onToggle: handleBiometricToggle,
                loading: isSettingUpBiometric,
              },
            ]
          : []),
        {
          icon: 'fa-lock',
          label: 'Change Password',
          desc: 'Update your password',
          onClick: () => navigate('/settings/password'),
        },
        {
          icon: 'fa-shield-alt',
          label: 'Two-Factor Auth',
          desc: 'Extra security layer',
          onClick: () => navigate('/settings/2fa'),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'fa-bell',
          label: 'Push Notifications',
          desc: 'Messages, orders, alerts',
          toggle: 'pushEnabled',
          value: pushEnabled,
        },
        {
          icon: 'fa-volume-up',
          label: 'Sound',
          desc: 'Notification sounds',
          toggle: 'soundEnabled',
          value: soundEnabled,
        },
        {
          icon: 'fa-envelope',
          label: 'Email Digest',
          desc: 'Daily summary',
          toggle: 'emailDigestEnabled',
          value: emailDigestEnabled,
        },
      ],
    },
    {
      title: 'Integrations',
      items: [
        {
          icon: 'fa-whatsapp',
          iconClass: 'brand',
          iconStyle: { background: 'var(--whatsapp-light)', color: 'var(--whatsapp)' },
          label: 'WhatsApp Business API',
          desc: user?.whatsappConnected ? `Connected • ${user.whatsappPhone}` : 'Not connected',
          onClick: () => navigate('/settings/whatsapp'),
        },
        {
          icon: 'fa-rupee-sign',
          iconStyle: { background: '#E3F2FD', color: '#1976D2' },
          label: 'Razorpay',
          desc: user?.razorpayConnected ? 'Connected' : 'Not connected',
          onClick: () => navigate('/settings/razorpay'),
        },
        {
          icon: 'fa-shipping-fast',
          iconStyle: { background: '#FFF3E0', color: '#F57C00' },
          label: 'Shiprocket',
          desc: user?.shiprocketConnected ? 'Connected' : 'Not connected',
          onClick: () => navigate('/settings/shiprocket'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'fa-question-circle',
          label: 'Help Center',
          desc: 'FAQs and guides',
          onClick: () => window.open('https://help.kaapav.com', '_blank'),
        },
        {
          icon: 'fa-headset',
          label: 'Contact Support',
          desc: 'Get help from our team',
          onClick: () => window.open('https://wa.me/919148330016', '_blank'),
        },
        {
          icon: 'fa-info-circle',
          label: 'About',
          desc: 'Version 1.0.0',
          onClick: () => {},
        },
      ],
    },
  ];

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <h1 className="header-title">Settings</h1>
      </div>

      <div className="screen-content with-nav">
        {/* Profile Card */}
        <div className="settings-profile">
          <div className="settings-avatar">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              getInitials(user?.name)
            )}
          </div>
          <div className="settings-user-info">
            <div className="settings-user-name">{user?.name || ''}</div>
            <div className="settings-user-email">{user?.email || ''}</div>
          </div>
          <button
            className="settings-edit-btn"
            onClick={() => navigate('/settings/profile')}
          >
            Edit
          </button>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <div key={section.title} className="settings-section">
            <div className="settings-section-title">{section.title}</div>
            <div className="settings-card">
              {section.items.map((item, index) => (
                <div
                  key={index}
                  className={`settings-item ${item.danger ? 'danger' : ''}`}
                  onClick={item.toggle ? undefined : item.onClick}
                  style={{ cursor: item.toggle ? 'default' : 'pointer' }}
                >
                  <div
                    className="settings-icon"
                    style={item.iconStyle || {}}
                  >
                    <i className={`${item.iconClass === 'brand' ? 'fab' : 'fas'} ${item.icon}`}></i>
                  </div>
                  <div className="settings-text">
                    <div className="settings-label">{item.label}</div>
                    {item.desc && <div className="settings-desc">{item.desc}</div>}
                  </div>
                  {item.toggle ? (
                    <div
                      className={`toggle ${item.value ? 'active' : ''} ${item.loading ? 'loading' : ''}`}
                      onClick={() => {
                        if (item.loading) return;
                        if (item.onToggle) {
                          item.onToggle();
                        } else {
                          toggleSetting(item.toggle);
                        }
                      }}
                      style={{ cursor: item.loading ? 'not-allowed' : 'pointer' }}
                    />
                  ) : (
                    <i className="fas fa-chevron-right settings-arrow"></i>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="settings-section">
          <div className="settings-card">
            <div className="settings-item danger" onClick={handleLogout}>
              <div className="settings-icon">
                <i className="fas fa-sign-out-alt"></i>
              </div>
              <div className="settings-text">
                <div className="settings-label">Log Out</div>
                <div className="settings-desc">Sign out from this device</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }}></div>
      </div>
    </div>
  );
}

export default Settings;
