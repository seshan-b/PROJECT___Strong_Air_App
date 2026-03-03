import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { messagesApi } from '../../api/client';
import type { User } from '../../types';

interface AppLayoutProps {
  user: User;
}

const AppLayout: React.FC<AppLayoutProps> = ({ user }) => {
  const [collapsed, setCollapsed] = useState(false);
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
