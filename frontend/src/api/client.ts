// api/client.ts
// The single file where all HTTP calls to the backend are defined.
// Every page in the app imports from here rather than calling axios directly.
//
// How it works:
//   - Creates one axios instance (called "api") with the backend URL as a base.
//   - A request interceptor automatically attaches the user's access token to
//     every outgoing request, so individual pages don't have to think about it.
//   - A response interceptor catches 401 "Unauthorized" errors. When the access
//     token expires, it silently fetches a new one using the refresh token and
//     retries the original request. If the refresh also fails, the user is
//     logged out and sent back to /login.
//   - The exported objects (authApi, usersApi, jobsApi, etc.) group related
//     endpoints together so they're easy to find and use.

import axios from 'axios';
import type { AuthTokens, User, Job, ClockSession, MessageThread, Message, HoursByUser, HoursByJob, HoursOverTime, DashboardSummary } from '../types';

// Use the backend URL set in the .env file, or fall back to the same host (useful in production).
const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Before every request: read the access token from localStorage and add it to the
// Authorization header. If there's no token, the request goes out without one
// (and the backend will return a 401 if the route requires login).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// After every response: if the server says 401 (token expired or invalid),
// try to get a new access token using the refresh token.
//   - _retry flag prevents an infinite loop if the refresh itself also returns 401.
//   - If refresh succeeds, the original request is retried with the new token.
//   - If refresh fails (token missing or expired), clear storage and go to login.
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
  updateProfile: (data: { name?: string; phone?: string; email?: string; username?: string }) =>
    api.patch<User>('/api/users/me', data),
  get: (userId: number) => api.get<User>(`/api/users/${userId}`),
  changeRole: (userId: number, role: string) =>
    api.patch<User>(`/api/users/${userId}/role`, { role }),
  delete: (userId: number) => api.delete(`/api/users/${userId}`),
};

// Jobs
export const jobsApi = {
  list: (status?: string) => api.get<Job[]>('/api/jobs', { params: status ? { status } : {} }),
  get: (jobId: number) => api.get<Job>(`/api/jobs/${jobId}`),
  create: (data: { title: string; description?: string; image_url?: string; location?: string; latitude?: number | null; longitude?: number | null }) =>
    api.post<Job>('/api/jobs', data),
  update: (jobId: number, data: { title?: string; description?: string; status?: string; location?: string; latitude?: number | null; longitude?: number | null }) =>
    api.patch<Job>(`/api/jobs/${jobId}`, data),
  assign: (jobId: number, userIds: number[]) =>
    api.post(`/api/jobs/${jobId}/assign`, { job_id: jobId, user_ids: userIds }),
  unassign: (jobId: number, userId: number) =>
    api.delete(`/api/jobs/${jobId}/assign/${userId}`),
  delete: (jobId: number) => api.delete(`/api/jobs/${jobId}`),
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
