export type UserRole = 'superadmin' | 'user';
export type UserStatus = 'pending' | 'verified' | 'suspended';
export type JobStatus = 'active' | 'archived';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  username: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  is_clocked_in?: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Job {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  status: JobStatus;
  created_at: string;
  assigned_users?: User[];
  has_active_session?: boolean;
}

export interface ClockSession {
  id: number;
  user_id: number;
  job_id: number;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  user_name?: string;
  job_title?: string;
}

export interface MessageThread {
  id: number;
  subject: string | null;
  created_by: number;
  created_at: string;
  last_message?: Message;
  unread_count: number;
  participants?: string[];
}

export interface Message {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_name?: string;
  body: string;
  created_at: string;
}

export interface HoursByUser {
  user_id: number;
  user_name: string;
  total_hours: number;
}

export interface HoursByJob {
  job_id: number;
  job_title: string;
  total_hours: number;
}

export interface HoursOverTime {
  date: string;
  total_hours: number;
}

export interface DashboardSummary {
  total_hours: number;
  total_users: number;
  pending_users: number;
  active_jobs: number;
  active_sessions: number;
}
