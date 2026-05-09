import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './NotificationBell.css';

const NOTIFICATION_STORAGE_KEY = 'ticketrush-notifications';
const KNOWN_EVENT_IDS_STORAGE_KEY = 'ticketrush-known-event-ids';
const EVENT_POLL_INTERVAL_MS = 30000;

function readJsonStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeNotification(notification) {
  return {
    ...notification,
    time: notification.time ? new Date(notification.time) : new Date(),
  };
}

function getEventLocation(event) {
  return event?.location || event?.venue?.name || event?.venue?.address || 'Venue TBA';
}

function buildEventNotification(event) {
  const startTime = event.startTime ? new Date(event.startTime).toLocaleString() : 'Date TBA';

  return {
    id: `event-created-${event.id}`,
    type: 'event_created',
    title: 'Su kien moi vua duoc mo ban',
    message: `${event.name || 'Untitled Event'} tai ${getEventLocation(event)}. Bat dau: ${startTime}.`,
    time: new Date(),
    read: false,
    eventId: event.id,
    actionUrl: `/events/${event.id}`,
  };
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => (
    readJsonStorage(NOTIFICATION_STORAGE_KEY, []).map(normalizeNotification)
  ));
  const [unreadCount, setUnreadCount] = useState(0);
  const isPollingRef = useRef(false);

  useEffect(() => {
    const count = notifications.filter((notification) => !notification.read).length;
    setUnreadCount(count);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const markAsRead = (id) => {
    setNotifications((previous) => (
      previous.map((notification) => (
        notification.id === id ? { ...notification, read: true } : notification
      ))
    ));
  };

  const markAllAsRead = () => {
    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications((previous) => previous.filter((notification) => notification.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
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
    let active = true;

    const syncNewEvents = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const response = await api.get('/events');
        const payload = response.data?.data?.content || response.data?.data || response.data || [];
        const events = Array.isArray(payload) ? payload : [];
        const currentIds = events.map((event) => String(event.id)).filter(Boolean);
        const knownIds = readJsonStorage(KNOWN_EVENT_IDS_STORAGE_KEY, null);

        if (!active) return;

        if (!Array.isArray(knownIds)) {
          localStorage.setItem(KNOWN_EVENT_IDS_STORAGE_KEY, JSON.stringify(currentIds));
          return;
        }

        const knownIdSet = new Set(knownIds);
        const newEvents = events.filter((event) => event?.id && !knownIdSet.has(String(event.id)));

        if (newEvents.length) {
          setNotifications((previous) => {
            const previousIds = new Set(previous.map((notification) => notification.id));
            const incoming = newEvents
              .map(buildEventNotification)
              .filter((notification) => !previousIds.has(notification.id));

            return [...incoming, ...previous].slice(0, 40);
          });
        }

        localStorage.setItem(KNOWN_EVENT_IDS_STORAGE_KEY, JSON.stringify(currentIds));
      } catch {
        // Keep existing notifications if the Event Service is temporarily unavailable.
      } finally {
        isPollingRef.current = false;
      }
    };

    syncNewEvents();
    const interval = window.setInterval(syncNewEvents, EVENT_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="notification-container">
      <button
        className="notification-bell"
        onClick={() => setIsOpen((value) => !value)}
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
              <div>
                <h3>Notifications</h3>
                <p>Event updates and ticket activity</p>
              </div>
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
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.actionUrl ? 'clickable' : ''}`}
                    onClick={() => openNotification(notification)}
                  >
                    <div className={`notification-icon ${notification.type === 'event_created' ? 'event' : ''}`}>
                      {notification.type === 'event_created' ? <Sparkles size={16} /> : <CalendarDays size={16} />}
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
        </>
      )}
    </div>
  );
}
