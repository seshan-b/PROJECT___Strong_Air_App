// App.tsx
// The root component of the frontend. Owns the logged-in user state and all routing.
//
// How authentication works on the frontend:
//   - On load, checks localStorage for a saved user + access_token.
//   - If both exist, the user is considered logged in and sees their role-specific routes.
//   - If not found, every route redirects to /login.
//   - handleUserUpdate syncs profile changes to both React state and localStorage immediately.
//
// Route groups:
//   Public  — /login, /register, /pending  (no login required)
//   Admin   — /admin/*  (only when user.role === 'superadmin')
//   Worker  — /worker/* (only when user.role === 'user')

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import type { User } from './types';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminJobsPage from './pages/admin/AdminJobsPage';
import AdminClockSessionsPage from './pages/admin/AdminClockSessionsPage';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerHoursPage from './pages/worker/WorkerHoursPage';
import WorkerProfilePage from './pages/worker/WorkerProfilePage';
import MessagesPage from './pages/shared/MessagesPage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user && (user.role === 'superadmin');
  const isWorker = user && user.role === 'user';

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to={isAdmin ? '/admin/dashboard' : '/worker/dashboard'} /> : <LoginPage onLoginSuccess={(userData) => setUser(userData)} />} />
        <Route path="/register" element={user ? <Navigate to={isAdmin ? '/admin/dashboard' : '/worker/dashboard'} /> : <RegisterPage />} />
        <Route path="/pending" element={<PendingApprovalPage />} />

        {/* Admin Routes */}
        {isAdmin && (
          <Route element={<AppLayout user={user} onLogout={handleLogout} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/jobs" element={<AdminJobsPage />} />
            <Route path="/admin/clock-sessions" element={<AdminClockSessionsPage />} />
            <Route path="/admin/messages" element={<MessagesPage currentUser={user} />} />
            <Route path="/admin/profile" element={<WorkerProfilePage user={user} onUserUpdate={handleUserUpdate} />} />
          </Route>
        )}

        {/* Worker Routes */}
        {isWorker && (
          <Route element={<AppLayout user={user} onLogout={handleLogout} />}>
            <Route path="/worker/dashboard" element={<WorkerDashboard user={user} />} />
            <Route path="/worker/hours" element={<WorkerHoursPage />} />
            <Route path="/worker/messages" element={<MessagesPage currentUser={user} />} />
            <Route path="/worker/profile" element={<WorkerProfilePage user={user} onUserUpdate={handleUserUpdate} />} />
          </Route>
        )}

        {/* Default redirects */}
        <Route path="*" element={<Navigate to={user ? (isAdmin ? '/admin/dashboard' : '/worker/dashboard') : '/login'} />} />
      </Routes>
    </Router>
  );
};

export default App;
