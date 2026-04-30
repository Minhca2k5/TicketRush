import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import './UserMenu.css';

// Mock user - trong thực tế sẽ lấy từ API/auth
const getMockUser = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return {
      id: 1,
      name: 'Admin User',
      email: 'admin@ticketrush.com',
      avatar: null,
      role: 'ADMIN',
    };
  }
  return null;
};

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(getMockUser());
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsOpen(false);
    navigate('/login');
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return null; // Header đã có Login/Register buttons
  }

  return (
    <div className="user-menu-container" ref={dropdownRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="user-avatar" />
        ) : (
          <div className="user-avatar-placeholder">
            {getInitials(user.name)}
          </div>
        )}
        <span className="user-name">{user.name}</span>
        <ChevronDown
          size={16}
          className={`chevron ${isOpen ? 'open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-user-info">
              <div className="dropdown-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <div className="user-avatar-placeholder">{getInitials(user.name)}</div>
                )}
              </div>
              <div>
                <p className="dropdown-user-name">{user.name}</p>
                <p className="dropdown-user-email">{user.email}</p>
                {user.role && (
                  <span className="user-role-badge">{user.role}</span>
                )}
              </div>
            </div>
          </div>

          <div className="dropdown-divider" />

          <div className="dropdown-items">
            <button className="dropdown-item" onClick={() => { navigate('/profile'); setIsOpen(false); }}>
              <User size={18} />
              <span>Profile</span>
            </button>
            <button className="dropdown-item" onClick={() => { navigate('/settings'); setIsOpen(false); }}>
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </div>

          <div className="dropdown-divider" />

          <div className="dropdown-items">
            <button className="dropdown-item logout" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
