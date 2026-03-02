import React, { useState } from 'react';
import { usersApi } from '../../api/client';
import { UserCircle, Save } from 'lucide-react';
import type { User } from '../../types';

interface WorkerProfileProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

const WorkerProfilePage: React.FC<WorkerProfileProps> = ({ user, onUserUpdate }) => {
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', email: user.email });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await usersApi.updateProfile(form);
      onUserUpdate(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Update failed');
    }
    setSaving(false);
  };

  return (
    <div className="animate-fade-in max-w-lg mx-auto" data-testid="worker-profile-page">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-primary-900">Profile Settings</h1>
        <p className="text-primary-500 text-sm mt-1">Update your personal details</p>
      </div>

      <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-primary-100">
          <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center font-heading font-bold text-xl">
            {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <p className="font-heading font-semibold text-lg text-primary-900">{user.name}</p>
            <p className="text-sm text-primary-500">@{user.username}</p>
            <span className="inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
              {user.status}
            </span>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4 text-sm" data-testid="profile-success">
            Profile updated successfully!
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm" data-testid="profile-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1.5">Full Name</label>
            <input
              data-testid="profile-name-input"
              type="text"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1.5">Email</label>
            <input
              data-testid="profile-email-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1.5">Phone</label>
            <input
              data-testid="profile-phone-input"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            data-testid="profile-save-button"
            type="submit"
            disabled={saving}
            className="w-full h-10 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WorkerProfilePage;
