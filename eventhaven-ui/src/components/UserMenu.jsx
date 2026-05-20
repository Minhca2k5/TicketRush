import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { clearAuth, getAuthRole, getAuthToken } from '../lib/auth';
import { getProfile } from '../services/authService';
import './UserMenu.css';

const getCurrentUser = () => {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  const role = getAuthRole() || 'CUSTOMER';
  return {
    name: role === 'ADMIN' ? 'Admin' : 'Customer',
    email: '',
    avatar: null,
    role,
  };
};

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const fallbackUser = getCurrentUser();
  const user = profileUser || fallbackUser;
  const profilePath = user?.role === 'ADMIN' ? '/admin/settings' : '/profile';
  const settingsPath = user?.role === 'ADMIN' ? '/admin/settings' : '/settings';

  useEffect(() => {
    if (!fallbackUser) {
      setProfileUser(null);
      return;
    }

    let isActive = true;

    getProfile()
      .then((profile) => {
        if (!isActive) {
          return;
        }

        const role = profile.role || fallbackUser.role;
        const name = profile.username || fallbackUser.name;
        setProfileUser({
          name,
          email: profile.email || '',
          avatar: null,
          role,
        });
      })
      .catch(() => {
        if (isActive) {
          setProfileUser(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fallbackUser?.role]);

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
    clearAuth();
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
    return null;
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
                {user.email && <p className="dropdown-user-email">{user.email}</p>}
                <span className="user-role-badge">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="dropdown-divider" />

          <div className="dropdown-items">
            <button className="dropdown-item" onClick={() => { navigate(profilePath); setIsOpen(false); }}>
              <User size={18} />
              <span>Profile</span>
            </button>
            <button className="dropdown-item" onClick={() => { navigate(settingsPath); setIsOpen(false); }}>
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
