// pages/admin/AdminDashboard.tsx
// The main analytics overview page visible only to admins.
//
// What it shows:
//   - Five stat cards at the top: total hours, total users, pending approvals,
//     active jobs, and workers currently clocked in.
//   - Three charts: hours broken down by worker, hours broken down by job,
//     and total hours logged over time (line chart).
//   - A date range filter (start/end date inputs) that re-fetches all four
//     analytics endpoints whenever the dates change.
//
// All data comes from the /api/analytics/* endpoints.
// StatCard and CustomTooltip are small helper components defined in this file
// to keep the chart and card rendering code clean and readable.

import React, { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Briefcase, Clock, UserPlus, Activity } from 'lucide-react';
import type { DashboardSummary, HoursByUser, HoursByJob, HoursOverTime } from '../../types';

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; accent?: boolean; testId: string }> = ({ icon, label, value, accent, testId }) => (
  <div data-testid={testId} className={`rounded-lg border p-6 ${accent ? 'bg-accent text-white border-accent' : 'bg-white border-primary-200'} shadow-sm hover:shadow-md transition-shadow`}>
    <div className="flex items-center justify-between mb-3">
      <span className={`${accent ? 'text-white/80' : 'text-primary-500'} text-sm font-medium`}>{label}</span>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-white/20' : 'bg-primary-50'}`}>
        {icon}
      </div>
    </div>
    <p className={`font-heading font-bold text-3xl ${accent ? 'text-white' : 'text-primary-900'}`}>{value}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-primary-200 rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-medium text-primary-900">{label}</p>
        <p className="text-accent font-semibold">{payload[0].value.toFixed(1)} hours</p>
      </div>
    );
  }
  return null;
};

const AdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hoursByUser, setHoursByUser] = useState<HoursByUser[]>([]);
  const [hoursByJob, setHoursByJob] = useState<HoursByJob[]>([]);
  const [hoursOverTime, setHoursOverTime] = useState<HoursOverTime[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchData = useCallback(async () => {
    try {
      const params = {
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
      };
      const [summaryRes, userRes, jobRes, timeRes] = await Promise.all([
        analyticsApi.summary(),
        analyticsApi.hoursByUser(params),
        analyticsApi.hoursByJob(params),
        analyticsApi.hoursOverTime(params),
      ]);
      setSummary(summaryRes.data);
      setHoursByUser(userRes.data);
      setHoursByJob(jobRes.data);
      setHoursOverTime(timeRes.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="animate-fade-in" data-testid="admin-dashboard">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary-900">Dashboard</h1>
          <p className="text-primary-500 text-sm mt-1">Workforce overview and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            data-testid="date-start-filter"
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="h-9 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="text-primary-400 text-sm">to</span>
          <input
            data-testid="date-end-filter"
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="h-9 px-3 rounded-md border border-primary-200 text-sm text-primary-700 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard testId="stat-total-hours" icon={<Clock size={18} className="text-accent" />} label="Total Hours" value={summary?.total_hours?.toFixed(1) || '0'} accent />
        <StatCard testId="stat-total-users" icon={<Users size={18} className="text-primary-500" />} label="Total Users" value={summary?.total_users || 0} />
        <StatCard testId="stat-pending-users" icon={<UserPlus size={18} className="text-primary-500" />} label="Pending Approval" value={summary?.pending_users || 0} />
        <StatCard testId="stat-active-jobs" icon={<Briefcase size={18} className="text-primary-500" />} label="Active Jobs" value={summary?.active_jobs || 0} />
        <StatCard testId="stat-active-sessions" icon={<Activity size={18} className="text-primary-500" />} label="Active Clocks" value={summary?.active_sessions || 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Hours by User */}
        <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-6" data-testid="chart-hours-by-user">
          <h3 className="font-heading font-semibold text-lg text-primary-900 mb-4">Hours by Worker</h3>
          {hoursByUser.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hoursByUser} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="user_name" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_hours" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-primary-400 text-sm">No data available</div>
          )}
        </div>

        {/* Hours by Job */}
        <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-6" data-testid="chart-hours-by-job">
          <h3 className="font-heading font-semibold text-lg text-primary-900 mb-4">Hours by Job</h3>
          {hoursByJob.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hoursByJob} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="job_title" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_hours" fill="#0F172A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-primary-400 text-sm">No data available</div>
          )}
        </div>
      </div>

      {/* Hours Over Time */}
      <div className="bg-white rounded-lg border border-primary-200 shadow-sm p-6" data-testid="chart-hours-over-time">
        <h3 className="font-heading font-semibold text-lg text-primary-900 mb-4">Hours Over Time</h3>
        {hoursOverTime.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hoursOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total_hours" stroke="#F97316" strokeWidth={2.5} dot={{ fill: '#F97316', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-primary-400 text-sm">No data available</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
