import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Ticket, Home, Calendar, Shield, Settings, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { isAdmin } from '../lib/auth';
import './Sidebar.css';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Hide sidebar on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const mainNavItems = [
    { to: '/', label: 'Home', icon: Home },
    ...(isAdmin() ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  const bottomNavItems = [
    { to: '/help', label: 'Help', icon: HelpCircle },
  ];

  const NavSection = ({ items }) => (
    <div className="nav-section">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={collapsed ? label : ''}
        >
          <Icon className="nav-item-icon" />
          {!collapsed && <span className="nav-item-label">{label}</span>}
        </NavLink>
      ))}
    </div>
  );

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="toggle-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <Ticket className="sidebar-logo-icon" />
        {!collapsed && <span className="sidebar-logo-text">TicketRush</span>}
      </div>

      {/* Main Navigation */}
      <NavSection items={mainNavItems} />

      {/* Bottom Navigation */}
      <div className="sidebar-bottom">
        <NavSection items={bottomNavItems} />
      </div>
    </aside>
  );
}
