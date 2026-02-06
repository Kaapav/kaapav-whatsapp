/**
 * ═══════════════════════════════════════════════════════════════
 * LOGIN SCREEN - Email/Password + Biometric Authentication
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../store';
import { authAPI } from '../api';
import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  getBiometricType,
  registerBiometric,
  authenticateBiometric,
} from '../utils/biometric';

function Login() {
  const navigate = useNavigate();
  const { setAuth, biometricEnabled, biometricCredentialId, enableBiometric } = useAuthStore();
  const { showToast } = useUIStore();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState({ name: 'Biometric', icon: 'fa-fingerprint' });
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  // Check biometric availability on mount
  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await isPlatformAuthenticatorAvailable();
    setBiometricAvailable(available);
    
    if (available) {
      setBiometricType(getBiometricType());
      
      // If biometric is enabled and credential exists, show prompt
      if (biometricEnabled && biometricCredentialId) {
        setShowBiometricPrompt(true);
      }
    }
  };

  // Handle email/password login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.login({ email: email.trim(), password });

      if (response.success && response.token) {
        setAuth(response.user, response.token, response.expiresAt);
        showToast(`Welcome back, ${response.user?.name || 'User'}! 👋`, 'success');
        
        // Offer biometric setup if available and not enabled
        if (biometricAvailable && !biometricEnabled) {
          offerBiometricSetup(response.user, response.token);
        } else {
          navigate('/chats');
        }
      } else {
        setError(response.error || 'Invalid credentials');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle biometric login
  const handleBiometricLogin = async () => {
    if (!biometricCredentialId) {
      showToast('Biometric not set up. Please login with password.', 'warning');
      setShowBiometricPrompt(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get challenge from server
      const challengeResponse = await authAPI.biometricChallenge();
      
      if (!challengeResponse.challenge) {
        throw new Error('Failed to get authentication challenge');
      }

      // Authenticate with biometric
      const credential = await authenticateBiometric(
        challengeResponse.challenge,
        biometricCredentialId
      );

      // Verify with server
      const response = await authAPI.biometricVerify(credential);

      if (response.success && response.token) {
        setAuth(response.user, response.token, response.expiresAt);
        showToast(`Welcome back, ${response.user?.name || 'User'}! 👋`, 'success');
        navigate('/chats');
      } else {
        throw new Error(response.error || 'Biometric verification failed');
      }
    } catch (err) {
      setError(err.message || 'Biometric authentication failed');
      setShowBiometricPrompt(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Offer biometric setup after successful login
  const offerBiometricSetup = async (user, token) => {
    const confirmed = window.confirm(
      `Enable ${biometricType.name} for faster login next time?`
    );

    if (confirmed) {
      try {
        // Get challenge for registration
        const challengeResponse = await authAPI.biometricChallenge();
        
        // Register biometric
        const credential = await registerBiometric(
          user.userId,
          user.email,
          challengeResponse.challenge
        );

        // Save to server
        await authAPI.biometricRegister(credential);
        
        // Save credential ID locally
        enableBiometric(credential.id);
        
        showToast(`${biometricType.name} enabled successfully! 🔐`, 'success');
      } catch (err) {
        console.error('Biometric setup failed:', err);
        showToast('Could not set up biometric. You can try again in Settings.', 'warning');
      }
    }

    navigate('/chats');
  };

  // Switch between biometric and password login
  const switchToPasswordLogin = () => {
    setShowBiometricPrompt(false);
  };

  const switchToBiometricLogin = () => {
    if (biometricEnabled && biometricCredentialId) {
      setShowBiometricPrompt(true);
    }
  };

  return (
    <div className="screen">
      <div className="login-container">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <i className="fab fa-whatsapp"></i>
          </div>
          <h1 className="login-title">KAAPAV Business</h1>
          <p className="login-subtitle">WhatsApp Business Manager for Fashion Jewellery</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Biometric Prompt */}
        {showBiometricPrompt && biometricAvailable && biometricEnabled ? (
          <div className="biometric-section">
            <div className="biometric-icon">
              <i className={`fas ${biometricType.icon}`}></i>
            </div>
            <div className="biometric-text">
              <div className="biometric-title">Login with {biometricType.name}</div>
              <div className="biometric-subtitle">Quick and secure authentication</div>
            </div>
            <button
              type="button"
              className={`biometric-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleBiometricLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <i className={`fas ${biometricType.icon}`}></i>
                  <span>Authenticate</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={switchToPasswordLogin}
              style={{ marginTop: '12px', width: '100%' }}
            >
              Use Password Instead
            </button>
          </div>
        ) : (
          <>
            {/* Login Form */}
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                    autoFocus
                  />
                  <i className="fas fa-envelope input-icon"></i>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password
                  <a href="#forgot" onClick={(e) => e.preventDefault()}>Forgot?</a>
                </label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    style={{ paddingRight: '44px' }}
                  />
                  <i className="fas fa-lock input-icon"></i>
                  <i
                    className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} input-toggle`}
                    onClick={() => setShowPassword(!showPassword)}
                  ></i>
                </div>
              </div>

              <button
                type="submit"
                className={`btn btn-gold ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
                style={{ width: '100%' }}
              >
                <span className="btn-text">Sign In</span>
                <div className="spinner"></div>
              </button>
            </form>

            {/* Biometric Option (if available but using password) */}
            {biometricAvailable && biometricEnabled && biometricCredentialId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={switchToBiometricLogin}
                style={{ width: '100%', marginTop: '12px' }}
              >
                <i className={`fas ${biometricType.icon}`}></i>
                <span>Use {biometricType.name}</span>
              </button>
            )}

            {/* Divider */}
            <div className="login-divider">
              <span>or continue with</span>
            </div>

            {/* Social Login (placeholder) */}
            <div className="social-login">
              <button type="button" className="social-btn google">
                <i className="fab fa-google"></i>
                Google
              </button>
              <button type="button" className="social-btn apple">
                <i className="fab fa-apple"></i>
                Apple
              </button>
            </div>

            {/* Footer */}
            <div className="login-footer">
              Don't have an account? <a href="#signup">Contact Admin</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
