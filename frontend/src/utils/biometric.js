/**
 * ═══════════════════════════════════════════════════════════════
 * BIOMETRIC AUTHENTICATION - WebAuthn/FIDO2
 * Fingerprint, Face ID, Windows Hello, etc.
 * ═══════════════════════════════════════════════════════════════
 */

// Check if WebAuthn is supported
export const isBiometricSupported = () => {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
};

// Check if platform authenticator is available (fingerprint, face id)
export const isPlatformAuthenticatorAvailable = async () => {
  if (!isBiometricSupported()) return false;
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
};

// Get biometric type name for UI
export const getBiometricType = () => {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(ua)) {
    return { name: 'Face ID / Touch ID', icon: 'fa-fingerprint' };
  }
  if (/android/.test(ua)) {
    return { name: 'Fingerprint', icon: 'fa-fingerprint' };
  }
  if (/windows/.test(ua)) {
    return { name: 'Windows Hello', icon: 'fa-fingerprint' };
  }
  if (/mac/.test(ua)) {
    return { name: 'Touch ID', icon: 'fa-fingerprint' };
  }
  
  return { name: 'Biometric', icon: 'fa-fingerprint' };
};

// Convert ArrayBuffer to Base64URL
const bufferToBase64URL = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Convert Base64URL to ArrayBuffer
const base64URLToBuffer = (base64URL) => {
  const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Register a new biometric credential
 * @param {string} userId - User ID
 * @param {string} userName - User email/name
 * @param {string} challenge - Server-provided challenge (base64)
 */
export const registerBiometric = async (userId, userName, challenge) => {
  if (!isBiometricSupported()) {
    throw new Error('Biometric authentication not supported');
  }

  const publicKeyCredentialCreationOptions = {
    challenge: base64URLToBuffer(challenge),
    rp: {
      name: 'KAAPAV Fashion Jewellery',
      id: window.location.hostname,
    },
    user: {
      id: new TextEncoder().encode(userId),
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Use device biometric
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    // Format credential for server
    return {
      id: credential.id,
      rawId: bufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
        attestationObject: bufferToBase64URL(credential.response.attestationObject),
      },
    };
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Biometric registration was cancelled');
    }
    if (error.name === 'InvalidStateError') {
      throw new Error('Biometric already registered for this account');
    }
    throw error;
  }
};

/**
 * Authenticate with biometric
 * @param {string} challenge - Server-provided challenge (base64)
 * @param {string} credentialId - Previously registered credential ID (base64)
 */
export const authenticateBiometric = async (challenge, credentialId = null) => {
  if (!isBiometricSupported()) {
    throw new Error('Biometric authentication not supported');
  }

  const publicKeyCredentialRequestOptions = {
    challenge: base64URLToBuffer(challenge),
    timeout: 60000,
    userVerification: 'required',
    rpId: window.location.hostname,
  };

  // If we have a specific credential ID, use it
  if (credentialId) {
    publicKeyCredentialRequestOptions.allowCredentials = [
      {
        id: base64URLToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal'],
      },
    ];
  }

  try {
    const credential = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    // Format assertion for server
    return {
      id: credential.id,
      rawId: bufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
        authenticatorData: bufferToBase64URL(credential.response.authenticatorData),
        signature: bufferToBase64URL(credential.response.signature),
        userHandle: credential.response.userHandle
          ? bufferToBase64URL(credential.response.userHandle)
          : null,
      },
    };
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Biometric authentication was cancelled');
    }
    if (error.name === 'SecurityError') {
      throw new Error('Biometric authentication failed - security error');
    }
    throw error;
  }
};

/**
 * Check if credential exists (for conditional UI)
 */
export const hasStoredCredential = async () => {
  if (!isBiometricSupported()) return false;
  
  try {
    // Try to silently check for available credentials
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32),
        timeout: 1,
        userVerification: 'discouraged',
        rpId: window.location.hostname,
      },
      mediation: 'silent',
    });
    return !!credential;
  } catch {
    return false;
  }
};
