import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store';

// Screens
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Chats from './screens/Chats';
import ChatWindow from './screens/ChatWindow';
import Orders from './screens/Orders';
import Products from './screens/Products';
import Customers from './screens/Customers';
import Broadcasts from './screens/Broadcasts';
import Analytics from './screens/Analytics';
import Settings from './screens/Settings';

// Components
import BottomNav from './components/BottomNav';

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTE WRAPPER
// ═══════════════════════════════════════════════════════════════

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT WITH BOTTOM NAV
// ═══════════════════════════════════════════════════════════════

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/chats" element={
        <ProtectedRoute>
          <AppLayout>
            <Chats />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/chats/:phone" element={
        <ProtectedRoute>
          <ChatWindow />
        </ProtectedRoute>
      } />
      
      <Route path="/orders" element={
        <ProtectedRoute>
          <AppLayout>
            <Orders />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/products" element={
        <ProtectedRoute>
          <AppLayout>
            <Products />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/customers" element={
        <ProtectedRoute>
          <AppLayout>
            <Customers />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/broadcasts" element={
        <ProtectedRoute>
          <AppLayout>
            <Broadcasts />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/analytics" element={
        <ProtectedRoute>
          <AppLayout>
            <Analytics />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      } />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}