/**
 * ════════════════════════════════════════════════════════════════
 * LOGIN SCREEN
 * Authentication with beautiful UI
 * ════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        toast.success('Welcome back!');
        navigate('/', { replace: true });
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <span className="text-3xl font-bold text-black">K</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white">KAAPAV</h1>
          <p className="text-gray-400 mt-1">WhatsApp Commerce Dashboard</p>
        </div>
        
        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onSubmit={handleSubmit}
          className="bg-dark-100 rounded-3xl p-6 border border-dark-200 shadow-xl"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>
          
          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <div className="relative">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@kaapav.com"
                className="input pl-11"
                disabled={isLoading}
              />
            </div>
          </div>
          
          {/* Password Input */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pl-11 pr-11"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          
          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={isLoading}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full py-3.5 text-base font-semibold disabled:opacity-50"
          >
            {isLoading ? (
              <FiLoader className="animate-spin" size={20} />
            ) : (
              'Sign In'
            )}
          </motion.button>
          
          {/* Demo credentials */}
          <p className="text-center text-gray-500 text-sm mt-4">
            Demo: admin@kaapav.com / admin123
          </p>
        </motion.form>
        
        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-6">
          Powered by WhatsApp Business API
        </p>
      </motion.div>
    </div>
  );
}