import React, { useEffect, useState } from 'react';
import { clockApi, usersApi, jobsApi } from '../../api/client';
import { Clock, Search } from 'lucide-react';
import type { ClockSession, User, Job } from '../../types';

const AdminClockSessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [filters, setFilters] = useState({ user_id: '', job_id: '', start_date: '', end_date: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const fetchData = async () => {
    try {
      const params: any = {};
      if (filters.user_id) params.user_id = parseInt(filters.user_id);
      if (filters.job_id) params.job_id = parseInt(filters.job_id);
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const [sessionsRes, usersRes, jobsRes] = await Promise.all([
        clockApi.sessions(params),
        usersApi.list({ status: 'verified' }),
        jobsApi.list(),
      ]);
      setSessions(sessionsRes.data);
      setUsers(usersRes.data);
      setJobs(jobsRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, [filters]);

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatDuration = (mins: number | null) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="animate-fade-in" data-testid="admin-clock-sessions-page">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-primary-900">Clock Sessions</h1>
        <p className="text-primary-500 text-sm mt-1">View all worker clock-in/out records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white rounded-lg border border-primary-200 p-4">
        <select
          data-testid="filter-user"
          value={filters.user_id}
          onChange={(e) => setFilters(p => ({ ...p, user_id: e.target.value }))}
          className="h-10 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All Workers</option>
          {users.filter(u => u.role === 'user').map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select
          data-testid="filter-job"
          value={filters.job_id}
          onChange={(e) => setFilters(p => ({ ...p, job_id: e.target.value }))}
          className="h-10 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All Jobs</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <input
          data-testid="filter-start-date"
          type="date"
          value={filters.start_date}
          onChange={(e) => setFilters(p => ({ ...p, start_date: e.target.value }))}
          className="h-10 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          data-testid="filter-end-date"
          type="date"
          value={filters.end_date}
          onChange={(e) => setFilters(p => ({ ...p, end_date: e.target.value }))}
          className="h-10 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-primary-200 shadow-sm overflow-hidden">
        <table className="w-full" data-testid="sessions-table">
          <thead className="bg-primary-50 border-b border-primary-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Worker</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Job</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Clock In</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Clock Out</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Duration</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-primary-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-primary-50/50 transition-colors" data-testid={`session-row-${session.id}`}>
                <td className="px-6 py-4 text-sm font-medium text-primary-900">{session.user_name || `User #${session.user_id}`}</td>
                <td className="px-6 py-4 text-sm text-primary-600">{session.job_title || `Job #${session.job_id}`}</td>
                <td className="px-6 py-4 text-sm text-primary-600">{formatDate(session.clock_in)}</td>
                <td className="px-6 py-4 text-sm text-primary-600">{session.clock_out ? formatDate(session.clock_out) : '-'}</td>
                <td className="px-6 py-4 text-sm font-medium text-primary-900">{formatDuration(session.duration_minutes)}</td>
                <td className="px-6 py-4">
                  {session.clock_out ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Complete</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-dot" />
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-primary-400 text-sm">No clock sessions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminClockSessionsPage;
