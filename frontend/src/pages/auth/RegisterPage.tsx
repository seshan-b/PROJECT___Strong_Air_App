// pages/auth/RegisterPage.tsx
// The account registration screen for new workers.
//
// What it does:
//   - Collects name, email, username, password, and an optional phone number.
//   - Calls POST /api/auth/register on submit.
//   - New accounts are always created with "pending" status — they cannot log in
//     until an admin approves them. After submitting, the user is sent to
//     /pending to see a "waiting for approval" message.
//   - Shows a toggleable show/hide eye button on the password field.
//   - Displays any error returned by the backend (e.g. email already taken).

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/client';
import { HardHat, Eye, EyeOff } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', phone: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(form);
      navigate('/pending');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <HardHat size={22} className="text-white" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl text-primary-900 tracking-tight">Strong Air</h1>
          </div>

          <h2 className="font-heading font-bold text-3xl text-primary-900 mb-2">Create account</h2>
          <p className="text-primary-500 mb-8">Register and wait for admin approval</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm" data-testid="register-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Full Name</label>
              <input
                data-testid="register-name-input"
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full h-11 px-4 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="John Builder"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1.5">Email</label>
                <input
                  data-testid="register-email-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full h-11 px-4 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1.5">Username</label>
                <input
                  data-testid="register-username-input"
                  type="text"
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  className="w-full h-11 px-4 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Phone (Optional)</label>
              <input
                data-testid="register-phone-input"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full h-11 px-4 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="register-password-input"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full h-11 px-4 pr-11 rounded-md border border-primary-200 bg-white text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
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
              data-testid="register-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent text-white font-medium rounded-md hover:bg-accent-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-primary-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-medium hover:underline" data-testid="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block w-[45%] relative">
        <img
          src="https://images.unsplash.com/photo-1694521787162-5373b598945c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwyfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjBzaXRlJTIwc2FmZXR5fGVufDB8fHx8MTc3MjQ0MTk2Mnww&ixlib=rb-4.1.0&q=85"
          alt="Construction site"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-950/80 to-primary-900/30" />
      </div>
    </div>
  );
};

export default RegisterPage;
