// pages/worker/WorkerHoursPage.tsx
// A personal hours log that workers use to review their own clock sessions.
//
// What it does:
//   - Fetches all clock sessions belonging to the logged-in worker from the backend.
//   - Displays each session as a card: job name, clock-in and clock-out times,
//     and duration formatted as "Xh Ym". In-progress sessions show "In Progress"
//     instead of a duration.
//   - A summary card at the top shows total hours and number of completed sessions
//     across the currently filtered date range.
//   - Two date pickers (start and end) let the worker filter by date range.
//     Changing either date triggers a new fetch automatically (via useCallback).

import React, { useCallback, useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { clockApi } from '../../api/client';
import { Clock } from 'lucide-react';
import { formatDate, formatDateTime, dateToApi } from '../../utils/date';
import type { ClockSession } from '../../types';

const WorkerHoursPage: React.FC = () => {
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const params: any = {};
      if (startDate) params.start_date = dateToApi(startDate);
      if (endDate) params.end_date = dateToApi(endDate);
      const res = await clockApi.sessions(params);
      setSessions(res.data);
    } catch (err) { console.error(err); }
  }, [startDate, endDate]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const totalHours = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
  const formatDuration = (mins: number | null) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto" data-testid="worker-hours-page">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-primary-900">My Hours</h1>
        <p className="text-primary-500 text-sm mt-1">Track your worked hours</p>
      </div>

      {/* Summary Card */}
      <div className="bg-accent text-white rounded-lg p-6 mb-6" data-testid="hours-summary">
        <div className="flex items-center gap-3 mb-2">
          <Clock size={20} className="text-white/80" />
          <span className="text-sm font-medium text-white/80">Total Hours Worked</span>
        </div>
        <p className="font-heading font-extrabold text-4xl">{totalHours.toFixed(1)}h</p>
        <p className="text-sm text-white/60 mt-1">{sessions.filter(s => s.clock_out).length} completed sessions</p>
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-3 mb-6">
        <DatePicker
          data-testid="hours-start-filter"
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          selectsStart
          startDate={startDate}
          endDate={endDate}
          maxDate={endDate ?? undefined}
          dateFormat="dd/MM/yyyy"
          placeholderText="DD/MM/YYYY"
          isClearable
          className="h-10 px-3 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-32"
        />
        <span className="text-primary-400 text-sm">to</span>
        <DatePicker
          data-testid="hours-end-filter"
          selected={endDate}
          onChange={(date) => setEndDate(date)}
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate ?? undefined}
          dateFormat="dd/MM/yyyy"
          placeholderText="DD/MM/YYYY"
          isClearable
          className="h-10 px-3 rounded-md border border-primary-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-32"
        />
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div key={session.id} data-testid={`hour-row-${session.id}`} className="bg-white rounded-lg border border-primary-200 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-primary-900">{session.job_title || `Job #${session.job_id}`}</p>
              <p className="text-xs text-primary-400 mt-0.5">
                {formatDateTime(session.clock_in)}
                {session.clock_out && ` – ${formatDate(session.clock_out)} ${new Date(session.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-heading font-bold text-lg text-primary-900">{formatDuration(session.duration_minutes)}</p>
              {!session.clock_out && (
                <span className="text-xs text-accent font-medium">In Progress</span>
              )}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center py-12 text-primary-400 text-sm">No hours recorded yet</div>
        )}
      </div>
    </div>
  );
};

export default WorkerHoursPage;
