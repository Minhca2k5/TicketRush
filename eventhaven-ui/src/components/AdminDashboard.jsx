import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../services/api';
import { getAuthToken } from '../lib/auth';

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

const AdminDashboard = () => {
  const [eventStats, setEventStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [eventResponse, userResponse] = await Promise.all([
          api.get('/events/dashboard'),
          axios.get('/auth/dashboard', {
            headers: { Authorization: `Bearer ${getAuthToken()}` },
          }),
        ]);
        setEventStats(eventResponse.data);
        setUserStats(userResponse.data.data);
      } catch (err) {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load dashboard');
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div className="admin-dashboard-shell">
      <section className="admin-hero">
        <div>
          <span className="admin-eyebrow">Admin Workspace</span>
          <h2>Manage events, seating, and launch readiness.</h2>
          <p>Use the admin panel to create event listings, generate seat maps, and prepare booking data for demo flows.</p>
        </div>
        <a className="admin-primary-action" href="/admin/events">Manage Events & Seats</a>
      </section>

      {error && <div className="dashboard-error">{error}</div>}

      <section className="admin-metrics-grid">
        <div className="admin-metric">
          <span>Events</span>
          <strong>{eventStats?.eventCount ?? '-'}</strong>
        </div>
        <div className="admin-metric">
          <span>Seats sold</span>
          <strong>{eventStats?.soldSeats ?? '-'}</strong>
        </div>
        <div className="admin-metric">
          <span>Occupancy</span>
          <strong>{eventStats ? `${eventStats.occupancyRate.toFixed(1)}%` : '-'}</strong>
        </div>
        <div className="admin-metric">
          <span>Estimated revenue</span>
          <strong>{eventStats ? formatCurrency(eventStats.estimatedRevenue) : '-'}</strong>
        </div>
      </section>

      <section className="admin-quick-grid">
        <div className="admin-quick-card">
          <strong>Events</strong>
          <span>{eventStats?.eventCount ?? 0} event listings in the system.</span>
        </div>
        <div className="admin-quick-card">
          <strong>Seat Maps</strong>
          <span>{eventStats?.availableSeats ?? 0} available, {eventStats?.lockedSeats ?? 0} held, {eventStats?.soldSeats ?? 0} sold.</span>
        </div>
        <div className="admin-quick-card">
          <strong>Audience</strong>
          <span>{userStats?.userCount ?? 0} users, average age {userStats ? userStats.averageAge.toFixed(1) : '0.0'}.</span>
        </div>
      </section>

      <section className="admin-quick-grid">
        <div className="admin-quick-card">
          <strong>Profiles</strong>
          <span>{userStats?.profileCompletionCount ?? 0} users have age and gender completed.</span>
        </div>
        <div className="admin-quick-card">
          <strong>Gender Split</strong>
          <span>{userStats?.maleCount ?? 0} male, {userStats?.femaleCount ?? 0} female.</span>
        </div>
        <div className="admin-quick-card">
          <strong>Roles</strong>
          <span>{userStats?.adminCount ?? 0} admins, {userStats?.customerCount ?? 0} customers.</span>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
