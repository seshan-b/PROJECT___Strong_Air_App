import React, { useEffect, useState, useCallback } from 'react';
import { jobsApi, clockApi, messagesApi } from '../../api/client';
import { Play, Square, Clock, Briefcase, MessageSquare } from 'lucide-react';
import type { Job, ClockSession, User } from '../../types';

interface WorkerDashboardProps {
  user: User;
}

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user }) => {
  const [assignedJobs, setAssignedJobs] = useState<Job[]>([]);
  const [activeSession, setActiveSession] = useState<ClockSession | null>(null);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, activeRes, unreadRes] = await Promise.all([
        jobsApi.myAssigned(),
        clockApi.active(),
        messagesApi.unreadCount(),
      ]);
      setAssignedJobs(jobsRes.data);
      setActiveSession(activeRes.data);
      setUnreadCount(unreadRes.data.unread_count);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Elapsed time ticker
  useEffect(() => {
    if (!activeSession) { setElapsed('00:00:00'); return; }
    const tick = () => {
      const start = new Date(activeSession.clock_in).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleClockIn = async () => {
    if (!selectedJob) return;
    setLoading(true);
    try {
      await clockApi.clockIn(selectedJob);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to clock in');
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await clockApi.clockOut();
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to clock out');
    }
    setLoading(false);
  };

  const activeJobTitle = activeSession
    ? assignedJobs.find(j => j.id === activeSession.job_id)?.title || `Job #${activeSession.job_id}`
    : null;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto" data-testid="worker-dashboard">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-primary-900">Hi, {user.name.split(' ')[0]}</h1>
        <p className="text-primary-500 text-sm mt-1">Ready to clock in?</p>
      </div>

      {/* Clock Widget */}
      <div className="bg-white rounded-xl border border-primary-200 shadow-sm p-8 mb-6" data-testid="clock-widget">
        {activeSession ? (
          <div className="text-center">
            <p className="text-sm font-medium text-accent mb-1">Currently working on</p>
            <p className="font-heading font-bold text-lg text-primary-900 mb-4">{activeJobTitle}</p>
            <p className="font-heading font-extrabold text-5xl text-primary-900 tracking-tight mb-6" data-testid="elapsed-timer">{elapsed}</p>
            <button
              data-testid="clock-out-button"
              onClick={handleClockOut}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-3 bg-destructive text-white rounded-md font-medium text-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Square size={20} /> Clock Out
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <Clock size={40} className="mx-auto text-primary-300 mb-3" />
              <p className="text-primary-500 text-sm">Select a job and clock in</p>
            </div>
            <div className="space-y-2 mb-6">
              {assignedJobs.map((job) => (
                <button
                  key={job.id}
                  data-testid={`select-job-${job.id}`}
                  onClick={() => setSelectedJob(job.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all ${
                    selectedJob === job.id
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                      : 'border-primary-200 hover:border-primary-300'
                  }`}
                >
                  <Briefcase size={18} className={selectedJob === job.id ? 'text-accent' : 'text-primary-400'} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${selectedJob === job.id ? 'text-accent' : 'text-primary-900'}`}>{job.title}</p>
                    {job.description && <p className="text-xs text-primary-400 mt-0.5 truncate">{job.description}</p>}
                  </div>
                </button>
              ))}
              {assignedJobs.length === 0 && (
                <div className="text-center py-8 text-primary-400 text-sm">No jobs assigned to you yet</div>
              )}
            </div>
            <button
              data-testid="clock-in-button"
              onClick={handleClockIn}
              disabled={loading || !selectedJob}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-md font-medium text-lg hover:bg-accent-600 transition-colors disabled:opacity-50"
            >
              <Play size={20} /> Clock In
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-primary-200 p-5" data-testid="stat-assigned-jobs">
          <div className="flex items-center gap-2 text-primary-500 mb-2">
            <Briefcase size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Assigned Jobs</span>
          </div>
          <p className="font-heading font-bold text-2xl text-primary-900">{assignedJobs.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-primary-200 p-5" data-testid="stat-unread-messages">
          <div className="flex items-center gap-2 text-primary-500 mb-2">
            <MessageSquare size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Unread Messages</span>
          </div>
          <p className="font-heading font-bold text-2xl text-primary-900">{unreadCount}</p>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
