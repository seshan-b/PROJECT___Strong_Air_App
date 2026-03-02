import React, { useEffect, useState } from 'react';
import { usersApi } from '../../api/client';
import { Check, X, Search } from 'lucide-react';
import type { User } from '../../types';

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'suspended'>('all');
  const [search, setSearch] = useState('');

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
      user: 'bg-primary-50 text-primary-600 border-primary-100',
    };
    return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[role] || ''}`;
  };

  const roleLabel = (role: string) => {
    if (role === 'superadmin') return 'Super Admin';
    return 'Worker';
  };

  return (
    <div className="animate-fade-in" data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary-900">User Management</h1>
          <p className="text-primary-500 text-sm mt-1">Manage and approve worker accounts</p>
        </div>
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
                <td className="px-6 py-4"><span className={roleBadge(user.role)}>{roleLabel(user.role)}</span></td>
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
    </div>
  );
};

export default AdminUsersPage;
