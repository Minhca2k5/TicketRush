import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Settings, User, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './NotificationBell.css';

// Mock notifications - trong thực tế sẽ gọi API
const generateMockNotifications = () => [
  {
    id: 1,
    type: 'booking_success',
    title: 'Booking Confirmed!',
    message: 'Your 2 tickets for "Concert: Rock Universe 2026" have been booked.',
    time: new Date(Date.now() - 1000 * 60 * 5), // 5 phút trước
    read: false,
  },
  {
    id: 2,
    type: 'seat_locked',
    title: 'Seat Hold Expiring',
    message: 'Your selected seats will be released in 4 minutes.',
    time: new Date(Date.now() - 1000 * 60 * 30),
    read: true,
  },
  {
    id: 3,
    type: 'promotion',
    title: 'Special Offer!',
    message: 'Get 20% off on all Standard zone tickets this weekend.',
    time: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: true,
  },
];

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : generateMockNotifications();
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const markAsRead = (id) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteNotification = (id) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.setItem('notifications', JSON.stringify([]));
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="notification-container">
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-backdrop" onClick={() => setIsOpen(false)} />
          <div className="notification-dropdown">
            <div className="notification-header">
              <h3>Notifications</h3>
              {notifications.length > 0 && (
                <div className="notification-actions">
                  <button onClick={markAllAsRead} title="Mark all as read">
                    <Check size={14} />
                    <span>Read all</span>
                  </button>
                  <button onClick={clearAll} title="Clear all">
                    <Trash2 size={14} />
                    <span>Clear</span>
                  </button>
                </div>
              )}
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="empty-notifications">
                  <Bell size={32} strokeWidth={1.5} />
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="notification-content">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <span className="notification-time">
                        {timeAgo(notification.time)}
                      </span>
                    </div>
                    <button
                      className="notification-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
