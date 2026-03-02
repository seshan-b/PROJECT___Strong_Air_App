import axios from 'axios';
import type { AuthTokens, User, Job, ClockSession, MessageThread, Message, HoursByUser, HoursByJob, HoursOverTime, DashboardSummary } from '../types';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401 and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refreshToken });
          const data: AuthTokens = res.data;
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthTokens>('/api/auth/login', { email, password }),
  register: (data: { name: string; email: string; username: string; password: string; phone?: string }) =>
    api.post<User>('/api/auth/register', data),
  refresh: (refresh_token: string) =>
    api.post<AuthTokens>('/api/auth/refresh', { refresh_token }),
  me: () => api.get<User>('/api/auth/me'),
};

// Users
export const usersApi = {
  list: (params?: { status?: string; role?: string }) =>
    api.get<User[]>('/api/users', { params }),
  pending: () => api.get<User[]>('/api/users/pending'),
  approve: (userId: number, status: string) =>
    api.patch<User>(`/api/users/${userId}/approve`, { status }),
  updateProfile: (data: { name?: string; phone?: string; email?: string }) =>
    api.patch<User>('/api/users/me', data),
  get: (userId: number) => api.get<User>(`/api/users/${userId}`),
  delete: (userId: number) => api.delete(`/api/users/${userId}`),
};

// Jobs
export const jobsApi = {
  list: (status?: string) => api.get<Job[]>('/api/jobs', { params: status ? { status } : {} }),
  get: (jobId: number) => api.get<Job>(`/api/jobs/${jobId}`),
  create: (data: { title: string; description?: string; image_url?: string }) =>
    api.post<Job>('/api/jobs', data),
  update: (jobId: number, data: { title?: string; description?: string; status?: string }) =>
    api.patch<Job>(`/api/jobs/${jobId}`, data),
  assign: (jobId: number, userIds: number[]) =>
    api.post(`/api/jobs/${jobId}/assign`, { job_id: jobId, user_ids: userIds }),
  unassign: (jobId: number, userId: number) =>
    api.delete(`/api/jobs/${jobId}/assign/${userId}`),
  myAssigned: () => api.get<Job[]>('/api/jobs/my/assigned'),
};

// Clock
export const clockApi = {
  clockIn: (jobId: number) => api.post<ClockSession>('/api/clock/in', { job_id: jobId }),
  clockOut: () => api.post<ClockSession>('/api/clock/out'),
  active: () => api.get<ClockSession | null>('/api/clock/active'),
  sessions: (params?: { user_id?: number; job_id?: number; start_date?: string; end_date?: string }) =>
    api.get<ClockSession[]>('/api/clock/sessions', { params }),
};

// Messages
export const messagesApi = {
  threads: () => api.get<MessageThread[]>('/api/messages/threads'),
  threadMessages: (threadId: number) =>
    api.get<Message[]>(`/api/messages/threads/${threadId}/messages`),
  createThread: (data: { subject: string; body: string; recipient_ids: number[] }) =>
    api.post<MessageThread>('/api/messages/threads', data),
  reply: (threadId: number, body: string) =>
    api.post<Message>(`/api/messages/threads/${threadId}/reply`, { body }),
  unreadCount: () => api.get<{ unread_count: number }>('/api/messages/unread-count'),
};

// Analytics
export const analyticsApi = {
  summary: () => api.get<DashboardSummary>('/api/analytics/summary'),
  hoursByUser: (params?: { start_date?: string; end_date?: string }) =>
    api.get<HoursByUser[]>('/api/analytics/hours-by-user', { params }),
  hoursByJob: (params?: { start_date?: string; end_date?: string }) =>
    api.get<HoursByJob[]>('/api/analytics/hours-by-job', { params }),
  hoursOverTime: (params?: { start_date?: string; end_date?: string }) =>
    api.get<HoursOverTime[]>('/api/analytics/hours-over-time', { params }),
};

export default api;
