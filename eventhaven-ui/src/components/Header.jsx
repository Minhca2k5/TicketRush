import { Link, useLocation } from 'react-router-dom';
import { Ticket, Home, Shield, LogOut, LogIn } from 'lucide-react';
import { useState } from 'react';
import { SearchBar } from './SearchBar';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { clearAuth, getAuthRole, getAuthToken } from '../lib/auth';
import './Header.css';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const token = getAuthToken();
  const role = getAuthRole();

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    ...(role === 'ADMIN' ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="site-header">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="logo">
          <Ticket className="logo-icon" />
          <span className="logo-text">TicketRush</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="desktop-nav">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${isActive(to) ? 'active' : ''}`}
            >
              <Icon className="nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Search Bar */}
        <div className="header-search">
          <SearchBar />
        </div>

        {/* Right Actions */}
        <div className="header-actions">
          <NotificationBell />
          {role === 'ADMIN' && (
            <Link to="/admin" className="admin-shortcut">
              <Shield className="nav-icon" />
              <span>Admin</span>
            </Link>
          )}
          <UserMenu />
          {!token && (
            <div className="auth-buttons">
              <Link to="/login" className="login-btn">
                <LogIn className="nav-icon" />
                <span>Login</span>
              </Link>
              <Link to="/register" className="register-btn">
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="mobile-nav">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`mobile-nav-link ${isActive(to) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon className="nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
          <div className="mobile-search">
            <SearchBar />
          </div>
          {token ? (
            <>
              <div className="mobile-user-info">
                <UserMenu />
              </div>
              <button
                className="mobile-nav-link logout"
                onClick={() => {
                  clearAuth();
                  window.location.href = '/';
                }}
              >
                <LogOut className="nav-icon" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                <LogIn className="nav-icon" />
                <span>Login</span>
              </Link>
              <Link to="/register" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                <span>Register</span>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
