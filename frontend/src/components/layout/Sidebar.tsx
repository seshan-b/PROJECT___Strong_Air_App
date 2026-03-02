import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Briefcase, Clock, MessageSquare, 
  LogOut, Shield, ChevronLeft, ChevronRight, HardHat
} from 'lucide-react';

interface SidebarProps {
  role: 'superadmin' | 'admin' | 'user';
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, collapsed, onToggle }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const isAdmin = role === 'superadmin' || role === 'admin';

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/jobs', icon: Briefcase, label: 'Jobs' },
    { to: '/admin/clock-sessions', icon: Clock, label: 'Clock Sessions' },
    { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
  ];

  const workerLinks = [
    { to: '/worker/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/worker/hours', icon: Clock, label: 'My Hours' },
    { to: '/worker/messages', icon: MessageSquare, label: 'Messages' },
    { to: '/worker/profile', icon: Users, label: 'Profile' },
  ];

  const links = isAdmin ? adminLinks : workerLinks;

  return (
    <aside
      data-testid="sidebar"
      className={`fixed top-0 left-0 h-full bg-primary-900 text-primary-300 flex flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-primary-800">
        <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center flex-shrink-0">
          <HardHat size={18} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-heading font-bold text-white text-lg tracking-tight">Strong Air</span>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-primary-800">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
            role === 'superadmin' ? 'bg-purple-500/20 text-purple-300' :
            role === 'admin' ? 'bg-accent/20 text-accent-300' :
            'bg-primary-700 text-primary-300'
          }`}>
            <Shield size={12} />
            {role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Worker'}
          </span>
        </div>
      )}

      {/* Nav Links */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            data-testid={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 mx-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-800 text-white border-l-4 border-accent -ml-0.5'
                  : 'text-primary-400 hover:text-white hover:bg-primary-800/50'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <link.icon size={20} className="flex-shrink-0" />
            {!collapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-primary-800 p-2">
        <button
          data-testid="sidebar-toggle"
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-primary-400 hover:text-white hover:bg-primary-800/50 rounded-md transition-colors text-sm"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          data-testid="logout-button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors text-sm"
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
