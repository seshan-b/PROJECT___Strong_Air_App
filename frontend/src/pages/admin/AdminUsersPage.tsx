import React, { useEffect, useState } from 'react';
import { usersApi } from '../../api/client';
import { UserPlus, Check, X, Shield, Search } from 'lucide-react';
import type { User } from '../../types';

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', username: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const res = await usersApi.list(params);
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchUsers(); }, [filter]);

  const handleApprove = async (userId: number, status: string) => {
    try {
      await usersApi.approve(userId, status);
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.createAdmin(adminForm);
      setShowCreateAdmin(false);
      setAdminForm({ name: '', email: '', username: '', password: '', phone: '' });
      fetchUsers();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      verified: 'bg-green-100 text-green-800 border-green-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
    };
    return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || ''}`;
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
      admin: 'bg-primary-100 text-primary-800 border-primary-200',
      user: 'bg-primary-50 text-primary-600 border-primary-100',
    };
    return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[role] || ''}`;
  };

  return (
    <div className="animate-fade-in" data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary-900">User Management</h1>
          <p className="text-primary-500 text-sm mt-1">Manage workers and admin accounts</p>
        </div>
        <button
          data-testid="create-admin-button"
          onClick={() => setShowCreateAdmin(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-900 text-white rounded-md text-sm font-medium hover:bg-primary-800 transition-colors"
        >
          <UserPlus size={16} /> Create Admin
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            data-testid="user-search-input"
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        {(['all', 'pending', 'verified', 'suspended'] as const).map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary-900 text-white' : 'bg-white border border-primary-200 text-primary-600 hover:bg-primary-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-primary-200 shadow-sm overflow-hidden">
        <table className="w-full" data-testid="users-table">
          <thead className="bg-primary-50 border-b border-primary-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-primary-50/50 transition-colors" data-testid={`user-row-${user.id}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span className="font-medium text-primary-900 text-sm">{user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-primary-600">{user.email}</td>
                <td className="px-6 py-4"><span className={roleBadge(user.role)}>{user.role}</span></td>
                <td className="px-6 py-4"><span className={statusBadge(user.status)}>{user.status}</span></td>
                <td className="px-6 py-4">
                  {user.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        data-testid={`approve-user-${user.id}`}
                        onClick={() => handleApprove(user.id, 'verified')}
                        className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        data-testid={`reject-user-${user.id}`}
                        onClick={() => handleApprove(user.id, 'suspended')}
                        className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {user.status === 'verified' && user.role === 'user' && (
                    <button
                      data-testid={`suspend-user-${user.id}`}
                      onClick={() => handleApprove(user.id, 'suspended')}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Suspend
                    </button>
                  )}
                  {user.status === 'suspended' && (
                    <button
                      data-testid={`reactivate-user-${user.id}`}
                      onClick={() => handleApprove(user.id, 'verified')}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-primary-400 text-sm">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="create-admin-modal">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <Shield size={20} className="text-accent" />
              <h3 className="font-heading font-semibold text-lg text-primary-900">Create Admin Account</h3>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <input data-testid="admin-name-input" type="text" placeholder="Full Name" value={adminForm.name} onChange={(e) => setAdminForm(p => ({ ...p, name: e.target.value }))} className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent" required />
              <input data-testid="admin-email-input" type="email" placeholder="Email" value={adminForm.email} onChange={(e) => setAdminForm(p => ({ ...p, email: e.target.value }))} className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent" required />
              <input data-testid="admin-username-input" type="text" placeholder="Username" value={adminForm.username} onChange={(e) => setAdminForm(p => ({ ...p, username: e.target.value }))} className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent" required />
              <input data-testid="admin-password-input" type="password" placeholder="Password" value={adminForm.password} onChange={(e) => setAdminForm(p => ({ ...p, password: e.target.value }))} className="w-full h-10 px-4 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent" required minLength={6} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateAdmin(false)} className="flex-1 h-10 border border-primary-200 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-50">Cancel</button>
                <button data-testid="admin-submit-button" type="submit" disabled={loading} className="flex-1 h-10 bg-primary-900 text-white rounded-md text-sm font-medium hover:bg-primary-800 disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
