import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, RotateCcw, Sparkles, Star, Ticket, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../services/authService';
import {
  clearNotifications,
  deleteNotification as deleteNotificationRequest,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import './NotificationBell.css';

const NOTIFICATION_POLL_INTERVAL_MS = 30000;

function getAccountHolderId(profile) {
  if (profile?.id) return `user-${profile.id}`;
  if (profile?.username) return `user-${profile.username}`;
  return null;
}

function normalizeNotification(notification) {
  return {
    ...notification,
    time: notification.createdAt ? new Date(notification.createdAt) : new Date(),
  };
}

function getNotificationIcon(type) {
  switch (type) {
    case 'TICKET_PURCHASED':
      return <Ticket size={16} />;
    case 'EVENT_UPCOMING':
      return <CalendarDays size={16} />;
    case 'SEAT_RELEASED':
      return <RotateCcw size={16} />;
    case 'EVENT_ENDED':
      return <Star size={16} />;
    default:
      return <Sparkles size={16} />;
  }
}

function getNotificationIconClass(type) {
  switch (type) {
    case 'TICKET_PURCHASED':
      return 'purchase';
    case 'EVENT_UPCOMING':
      return 'event';
    case 'SEAT_RELEASED':
      return 'release';
    case 'EVENT_ENDED':
      return 'ended';
    default:
      return 'event';
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const isPollingRef = useRef(false);

  const loadNotifications = useCallback(async (targetUserId = userId) => {
    if (!targetUserId || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;
    setLoading(true);
    try {
      const [payload, count] = await Promise.all([
        getNotifications(targetUserId),
        getUnreadNotificationCount(targetUserId),
      ]);
      setNotifications((Array.isArray(payload) ? payload : []).map(normalizeNotification));
      setUnreadCount(count);
    } catch {
      // Keep the current list if the notification service is temporarily unavailable.
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;

    getProfile()
      .then((profile) => {
        if (!active) return;
        const holderId = getAccountHolderId(profile);
        setUserId(holderId);
        if (holderId) {
          loadNotifications(holderId);
        }
      })
      .catch(() => {
        if (active) setUserId(null);
      });

    return () => {
      active = false;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const interval = window.setInterval(() => loadNotifications(userId), NOTIFICATION_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadNotifications, userId]);

  const markAsRead = async (id) => {
    if (!userId) return;

    const wasUnread = notifications.some((notification) => notification.id === id && !notification.read);
    setNotifications((previous) => (
      previous.map((notification) => (
        notification.id === id ? { ...notification, read: true } : notification
      ))
    ));
    if (wasUnread) {
      setUnreadCount((previous) => Math.max(previous - 1, 0));
    }

    try {
      await markNotificationRead(userId, id);
    } catch {
      loadNotifications(userId);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
    try {
      const payload = await markAllNotificationsRead(userId);
      setNotifications((Array.isArray(payload) ? payload : []).map(normalizeNotification));
    } catch {
      loadNotifications(userId);
    }
  };

  const deleteNotification = async (id) => {
    if (!userId) return;

    const removedNotification = notifications.find((notification) => notification.id === id);
    setNotifications((previous) => previous.filter((notification) => notification.id !== id));
    if (removedNotification && !removedNotification.read) {
      setUnreadCount((previous) => Math.max(previous - 1, 0));
    }
    try {
      await deleteNotificationRequest(userId, id);
    } catch {
      loadNotifications(userId);
    }
  };

  const clearAll = async () => {
    if (!userId) return;

    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
    try {
      await clearNotifications(userId);
    } catch {
      loadNotifications(userId);
    }
  };

  const timeAgo = (date) => {
    const parsedDate = date instanceof Date ? date : new Date(date);
    const seconds = Math.floor((new Date() - parsedDate) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const openNotification = (notification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    loadNotifications(userId);

    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, loadNotifications, userId]);

  return (
    <div className="notification-container" ref={containerRef}>
      <button
        className="notification-bell"
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <div>
              <h3>Notifications</h3>
              <p>Tickets, upcoming events, and released seats</p>
            </div>
            {notifications.length > 0 && (
              <div className="notification-actions">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    markAllAsRead();
                  }}
                  title="Mark all as read"
                >
                  <Check size={14} />
                  <span>Read all</span>
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    clearAll();
                  }}
                  title="Clear all"
                >
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
                <p>{loading ? 'Loading notifications...' : 'No notifications'}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.actionUrl ? 'clickable' : ''}`}
                  onClick={() => openNotification(notification)}
                >
                  <div className={`notification-icon ${getNotificationIconClass(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {timeAgo(notification.time)}
                    </span>
                  </div>
                  <button
                    className="notification-delete"
                    onClick={(event) => {
                      event.stopPropagation();
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
      )}
    </div>
  );
}
