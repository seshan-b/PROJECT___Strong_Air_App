// components/layout/AppLayout.tsx
// The shared page shell used by every protected route (admin and worker alike).
//
// What it does:
//   - Renders the Sidebar on the left and the current page content on the right.
//   - The Sidebar can be collapsed to a narrow icon-only strip — AppLayout
//     tracks that state and shifts the main content area accordingly.
//   - Shows a sticky top header bar with the logged-in user's name and avatar.
//   - Polls the backend every 30 seconds to get the current unread message count,
//     then passes that number down to the Sidebar so it can show a badge on the
//     Messages link.
//   - Uses React Router's <Outlet /> to render whichever child route is active.

import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { messagesApi } from '../../api/client';
import type { User } from '../../types';

interface AppLayoutProps {
  user: User;
  onLogout: () => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ user, onLogout }) => {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await messagesApi.unreadCount();
        setUnreadCount(res.data.unread_count);
      } catch { /* silent */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-primary-50" data-testid="app-layout">
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        unreadCount={unreadCount}
        onLogout={onLogout}
      />
      <main
        className={`transition-all duration-300 min-h-screen ${
          collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-primary-200 flex items-center justify-between px-8 sticky top-0 z-30">
          <div />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-primary-900" data-testid="header-user-name">{user.name}</p>
              <p className="text-xs text-primary-500">{user.email}</p>
            </div>
            <div className="w-9 h-9 bg-accent/10 text-accent rounded-full flex items-center justify-center font-heading font-bold text-sm">
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
