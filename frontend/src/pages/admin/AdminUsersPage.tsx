import React, { useCallback, useEffect, useState } from 'react';
import { usersApi, authApi } from '../../api/client';
import { Check, X, Search, Trash2 } from 'lucide-react';
import type { User } from '../../types';

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'suspended'>('all');
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    authApi.me().then(res => setCurrentUserId(res.data.id)).catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const res = await usersApi.list(params);
      setUsers(res.data);
    } catch (err) { console.error(err); }
  }, [filter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleApprove = async (userId: number, status: string) => {
    try {
      await usersApi.approve(userId, status);
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (userId: number) => {
    try {
      await usersApi.delete(userId);
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleChangeRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'superadmin' ? 'user' : 'superadmin';
    try {
      await usersApi.changeRole(userId, newRole);
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
                <td className="px-6 py-4">
                  {user.id === currentUserId ? (
                    <span className={roleBadge(user.role)}>{roleLabel(user.role)}</span>
                  ) : (
                    <button
                      data-testid={`change-role-${user.id}`}
                      onClick={() => handleChangeRole(user.id, user.role)}
                      title={user.role === 'superadmin' ? 'Click to demote to Worker' : 'Click to promote to Super Admin'}
                      className={`${roleBadge(user.role)} cursor-pointer hover:opacity-75 transition-opacity`}
                    >
                      {roleLabel(user.role)}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4"><span className={statusBadge(user.status)}>{user.status}</span></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.status === 'pending' && (
                      <>
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
                      </>
                    )}
                    {user.status === 'verified' && user.role === 'user' && (
                      <button
                        data-testid={`suspend-user-${user.id}`}
                        onClick={() => { if (!user.is_clocked_in) handleApprove(user.id, 'suspended'); }}
                        disabled={user.is_clocked_in}
                        title={user.is_clocked_in ? 'Cannot suspend a user who is currently clocked in' : undefined}
                        className={`text-xs font-medium ${user.is_clocked_in ? 'text-primary-300 cursor-not-allowed' : 'text-red-600 hover:text-red-700'}`}
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
                    {user.role === 'user' && (
                      <button
                        data-testid={`delete-user-${user.id}`}
                        onClick={() => handleDelete(user.id)}
                        disabled={user.status !== 'suspended'}
                        title={user.status !== 'suspended' ? 'Suspend the worker before deleting' : 'Delete worker'}
                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                          user.status !== 'suspended'
                            ? 'text-primary-300 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-700'
                        }`}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
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
