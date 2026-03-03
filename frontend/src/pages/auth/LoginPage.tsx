// pages/auth/LoginPage.tsx
// The login screen. This is the first page most users see.
//
// What it does:
//   - Accepts an email and password, then calls POST /api/auth/login.
//   - On success: saves the access token, refresh token, and user object to
//     localStorage, then tells the parent (App.tsx) who logged in via onLoginSuccess.
//     The parent then redirects to the correct dashboard based on role.
//   - On failure: shows the error message returned by the backend.
//   - Has a show/hide toggle on the password field (the eye icon).
//   - If the user is already logged in, App.tsx redirects away before this page
//     even renders, so no need to handle that case here.

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/client';
import { HardHat, Eye, EyeOff } from 'lucide-react';
import type { User } from '../../types';

interface LoginPageProps {
  onLoginSuccess?: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const data = res.data;
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Update parent component state
      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }

      if (data.user.role === 'superadmin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/worker/dashboard');
      }
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.detail === 'Account pending approval') {
        navigate('/pending');
        return;
      }
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <HardHat size={22} className="text-white" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl text-primary-900 tracking-tight">Strong Air</h1>
          </div>

          <h2 className="font-heading font-bold text-3xl text-primary-900 mb-2">Welcome back</h2>
          <p className="text-primary-500 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm" data-testid="login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                placeholder="you@strongair.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-4 pr-11 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent text-white font-medium rounded-md hover:bg-accent-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-primary-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent font-medium hover:underline" data-testid="register-link">
              Register here
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Hero Image */}
      <div className="hidden lg:block w-[45%] relative">
        <img
          src="https://images.unsplash.com/photo-1694521787162-5373b598945c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwyfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBzaXRlJTIwc2FmZXR5fGVufDB8fHx8MTc3MjQ0MTk2Mnww&ixlib=rb-4.1.0&q=85"
          alt="Construction site"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-950/80 to-primary-900/30" />
        <div className="absolute bottom-12 left-8 right-8">
          <p className="text-white/90 font-heading font-bold text-2xl leading-tight">
            Workforce management<br />built for the field.
          </p>
          <p className="text-white/60 text-sm mt-3">Track hours. Manage teams. Stay on schedule.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
