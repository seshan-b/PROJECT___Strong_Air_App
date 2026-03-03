// pages/admin/AdminClockSessionsPage.tsx
// A read-only log of all clock-in/out records, accessible only to admins.
//
// What it does:
//   - Loads all clock sessions from the backend and displays them in a table.
//   - Each row shows: worker name, job name, clock-in time, clock-out time,
//     duration, and a status badge (Active = still clocked in, Complete = done).
//   - Filter panel at the top lets the admin narrow results by:
//       * Worker (dropdown of all verified users)
//       * Job (dropdown of all jobs)
//       * Date range (two date pickers — start and end)
//   - Filters are applied by re-fetching from the backend whenever they change.
//   - Uses Promise.allSettled so that if one API call fails, the others still
//     load (e.g. the sessions table still appears even if the jobs list fails).
//   - Duration is shown as "Xh Ym". Active (still clocked in) sessions show "-".

import React, { useCallback, useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { clockApi, usersApi, jobsApi } from '../../api/client';
import { formatDateTime, dateToApi } from '../../utils/date';
import type { ClockSession, User, Job } from '../../types';

const AdminClockSessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [filters, setFilters] = useState({ user_id: '', job_id: '' });
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: any = {};
    if (filters.user_id) params.user_id = parseInt(filters.user_id);
    if (filters.job_id) params.job_id = parseInt(filters.job_id);
    if (startDate) params.start_date = dateToApi(startDate);
    if (endDate) params.end_date = dateToApi(endDate);

    const [sessionsResult, usersResult, jobsResult] = await Promise.allSettled([
      clockApi.sessions(params),
      usersApi.list({ status: 'verified' }),
      jobsApi.list(),
    ]);

    if (sessionsResult.status === 'fulfilled') {
      setSessions(sessionsResult.value.data);
    } else {
      const err = (sessionsResult as PromiseRejectedResult).reason;
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((e: any) => e.msg).join(' · ') : detail || 'Failed to load clock sessions');
    }

    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value.data);
    }

    if (jobsResult.status === 'fulfilled') {
      setJobs(jobsResult.value.data);
    }

    setLoading(false);
  }, [filters, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

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
        <DatePicker
          data-testid="filter-start-date"
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          selectsStart
          startDate={startDate}
          endDate={endDate}
          maxDate={endDate ?? undefined}
          dateFormat="dd/MM/yyyy"
          placeholderText="DD/MM/YYYY"
          isClearable
          className="h-10 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent w-32"
        />
        <DatePicker
          data-testid="filter-end-date"
          selected={endDate}
          onChange={(date) => setEndDate(date)}
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate ?? undefined}
          dateFormat="dd/MM/yyyy"
          placeholderText="DD/MM/YYYY"
          isClearable
          className="h-10 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent w-32"
        />
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-primary-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="px-6 py-8 text-center text-primary-400 text-sm">Loading...</div>
        )}
        <table className="w-full" data-testid="sessions-table" style={{ display: loading ? 'none' : undefined }}>
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
                <td className="px-6 py-4 text-sm text-primary-600">{formatDateTime(session.clock_in)}</td>
                <td className="px-6 py-4 text-sm text-primary-600">{session.clock_out ? formatDateTime(session.clock_out) : '-'}</td>
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
