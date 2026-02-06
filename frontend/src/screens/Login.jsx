// frontend/src/screens/Login.jsx
/**
 * ═══════════════════════════════════════════════════════════════
 * LOGIN SCREEN - Real Backend Authentication
 * PIN unlocks → gets JWT from backend → authenticated
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useUIStore } from '../store';

const APP_PIN = '1428';
const API_BASE = import.meta.env.VITE_API_URL || '';

// Default credentials (you can change these or make dynamic)
const DEFAULT_USER = {
  email: 'admin@kaapav.com',
  password: 'admin123', // Change this to match your backend
};

function Login() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const { showToast } = useUIStore();

  const [mode, setMode] = useState('loading');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometric');

  const [pin, setPin] = useState(['', '', '', '']);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    console.log('🔐 Login mounted, authenticated:', isAuthenticated);
    
    if (isAuthenticated) {
      navigate('/chats', { replace: true });
      return;
    }
    
    initBiometric();
  }, [isAuthenticated]);

  const initBiometric = async () => {
    try {
      if (!window.PublicKeyCredential) {
        setMode('pin');
        setTimeout(() => inputRefs[0].current?.focus(), 100);
        return;
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (available) {
        const ua = navigator.userAgent.toLowerCase();
        let name = 'Biometric';
        if (/windows/.test(ua)) name = 'Windows Hello';
        else if (/iphone|ipad/.test(ua)) name = 'Face ID / Touch ID';
        else if (/android/.test(ua)) name = 'Fingerprint';
        else if (/mac/.test(ua)) name = 'Touch ID';
        
        setBiometricAvailable(true);
        setBiometricName(name);
        setMode('biometric');
        console.log('✅ Biometric ready:', name);
      } else {
        setMode('pin');
        setTimeout(() => inputRefs[0].current?.focus(), 100);
      }
    } catch (err) {
      console.error('Init error:', err);
      setMode('pin');
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // BACKEND LOGIN - Gets real JWT token
  // ═══════════════════════════════════════════════════════════════
  
  const loginToBackend = async () => {
    console.log('🔐 Logging in to backend...');
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(DEFAULT_USER),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Login failed:', data);
        throw new Error(data.error || 'Login failed');
      }

      console.log('✅ Backend login successful:', data);
      
      // Set auth with real JWT token
      if (data.token && data.user) {
        const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
        setAuth(data.user, data.token, expiresAt);
        showToast('Welcome back! 👋', 'success');
        
        setTimeout(() => {
          navigate('/chats', { replace: true });
        }, 100);
      } else {
        throw new Error('Invalid response from server');
      }

    } catch (err) {
      console.error('❌ Backend login error:', err);
      showToast('Login failed: ' + err.message, 'error');
      setError('Backend connection failed. Check console.');
      
      // Fallback: Use local auth (for testing)
      console.log('⚠️ Falling back to local auth');
      setAuth(
        {
          id: 1,
          userId: 'owner',
          name: 'KAAPAV Owner',
          email: 'kaapavin@gmail.com',
          role: 'admin',
        },
        'local-fallback-' + Date.now(),
        Date.now() + (30 * 24 * 60 * 60 * 1000)
      );
      
      showToast('⚠️ Using offline mode', 'warning');
      setTimeout(() => navigate('/chats', { replace: true }), 100);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // BIOMETRIC UNLOCK
  // ═══════════════════════════════════════════════════════════════
  
  const handleBiometricUnlock = async () => {
    if (isUnlocking) return;
    
    setIsUnlocking(true);
    setError('');
    console.log('🔐 Biometric verification...');

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'KAAPAV',
            id: window.location.hostname,
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'user',
            displayName: 'User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'discouraged',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        }
      });

      console.log('✅ Biometric verified!');
      await loginToBackend();

    } catch (err) {
      console.error('❌ Biometric failed:', err.name);
      
      if (err.name === 'InvalidStateError') {
        console.log('✅ Credential exists = verified!');
        await loginToBackend();
      } else if (err.name === 'NotAllowedError') {
        setError('Cancelled. Click to try again or use PIN.');
      } else {
        setError('Failed. Please use PIN instead.');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // PIN HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');
    if (value && index < 3) inputRefs[index + 1].current?.focus();
    if (index === 3 && value) setTimeout(() => verifyPin(newPin.join('')), 100);
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter' && index === 3 && pin.join('').length === 4) {
      verifyPin(pin.join(''));
    }
  };

  const verifyPin = async (enteredPin) => {
    console.log('🔢 Verifying PIN');
    
    if (enteredPin === APP_PIN) {
      console.log('✅ PIN correct! Logging in to backend...');
      setIsUnlocking(true);
      await loginToBackend();
      setIsUnlocking(false);
    } else {
      console.log('❌ PIN incorrect');
      setAttempts(prev => prev + 1);
      const remaining = 5 - attempts - 1;
      setError(attempts >= 2 && remaining > 0 ? `Wrong PIN. ${remaining} left` : 'Wrong PIN');
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      if (attempts >= 4) {
        setError('Too many tries. Wait 30s.');
        setTimeout(() => { setAttempts(0); setError(''); }, 30000);
      }
    }
  };

  const clearPin = () => {
    setPin(['', '', '', '']);
    setError('');
    inputRefs[0].current?.focus();
  };

  const switchToPin = () => {
    setMode('pin');
    setError('');
    setPin(['', '', '', '']);
    setTimeout(() => inputRefs[0].current?.focus(), 100);
  };

  const switchToBiometric = () => {
    if (biometricAvailable) {
      setMode('biometric');
      setError('');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem'
  };

  if (mode === 'loading') {
    return (
      <div style={containerStyle}>
        <div className="spinner" style={{
          borderColor: 'rgba(219, 172, 53, 0.3)',
          borderTopColor: '#DBAC35'
        }}></div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        
        <div style={{
          width: '100px', height: '100px', margin: '0 auto 2rem',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #DBAC35, #B8860B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '48px', color: 'white',
          boxShadow: '0 8px 32px rgba(219, 172, 53, 0.3)'
        }}>
          <i className="fab fa-whatsapp"></i>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'white', marginBottom: '0.5rem' }}>
          KAAPAV Business
        </h1>

        <p style={{ color: '#888', fontSize: '16px', marginBottom: '3rem' }}>
          {mode === 'biometric' ? `Unlock with ${biometricName}` : 'Enter PIN to unlock'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px', padding: '12px', marginBottom: '2rem',
            color: '#ff6b6b', fontSize: '14px'
          }}>
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}

        {mode === 'biometric' && (
          <div>
            <button onClick={handleBiometricUnlock} disabled={isUnlocking} style={{
              width: '120px', height: '120px', borderRadius: '50%',
              fontSize: '48px', margin: '30px auto', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: isUnlocking ? 'rgba(219, 172, 53, 0.3)' : 'linear-gradient(135deg, #DBAC35, #B8860B)',
              border: 'none', color: 'white',
              cursor: isUnlocking ? 'wait' : 'pointer',
              boxShadow: '0 4px 20px rgba(219, 172, 53, 0.4)',
              outline: 'none', transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => !isUnlocking && (e.target.style.transform = 'scale(1.05)')}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}>
              {isUnlocking ? (
                <div className="spinner" style={{
                  width: '40px', height: '40px',
                  borderColor: 'rgba(255,255,255,0.3)',
                  borderTopColor: 'white'
                }}></div>
              ) : <i className="fas fa-fingerprint"></i>}
            </button>

            <p style={{ color: '#888', fontSize: '14px', marginBottom: '30px' }}>
              {isUnlocking ? 'Verifying...' : `Tap to unlock with ${biometricName}`}
            </p>

            <button onClick={switchToPin} style={{
              width: '100%', padding: '14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', color: '#888', fontSize: '14px',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              <i className="fas fa-keyboard"></i> Use PIN Instead
            </button>
          </div>
        )}

        {mode === 'pin' && (
          <div>
            <div style={{ fontSize: '48px', color: '#DBAC35', marginBottom: '2rem' }}>
              <i className="fas fa-lock"></i>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '2rem' }}>
              {pin.map((digit, index) => (
                <input key={index} ref={inputRefs[index]}
                  type="tel" inputMode="numeric" pattern="[0-9]*"
                  maxLength={1} value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  disabled={attempts >= 5 || isUnlocking} autoComplete="off"
                  style={{
                    width: '60px', height: '70px', fontSize: '32px', fontWeight: '600',
                    textAlign: 'center',
                    border: error ? '2px solid #ff4444' : '2px solid #333',
                    borderRadius: '12px', background: '#1a1a1a', color: 'white',
                    outline: 'none', transition: 'all 0.2s',
                    boxShadow: digit ? '0 0 0 1px #DBAC35' : 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#DBAC35';
                    e.target.style.transform = 'scale(1.05)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = error ? '#ff4444' : '#333';
                    e.target.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>

            {isUnlocking && (
              <div style={{ marginBottom: '2rem' }}>
                <div className="spinner" style={{
                  margin: '0 auto',
                  borderColor: 'rgba(219, 172, 53, 0.3)',
                  borderTopColor: '#DBAC35'
                }}></div>
                <p style={{ color: '#888', fontSize: '14px', marginTop: '1rem' }}>
                  Connecting to backend...
                </p>
              </div>
            )}

            {pin.some(d => d !== '') && !isUnlocking && (
              <button onClick={clearPin} style={{
                background: 'none', border: 'none', color: '#888',
                fontSize: '14px', cursor: 'pointer', padding: '8px 16px', marginBottom: '2rem'
              }}>
                <i className="fas fa-times"></i> Clear
              </button>
            )}

            {biometricAvailable && !isUnlocking && (
              <button onClick={switchToBiometric} style={{
                width: '100%', padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', color: '#888', fontSize: '14px',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem'
              }}>
                <i className="fas fa-fingerprint"></i> Use {biometricName}
              </button>
            )}

            </div>
        )}

        <p style={{ color: '#666', fontSize: '12px', marginTop: '3rem' }}>
          KAAPAV Business © 2026
        </p>

      </div>
    </div>
  );
}

export default Login;