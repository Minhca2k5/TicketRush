import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Home.css';

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchQuery = new URLSearchParams(location.search).get('search') || '';

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on search query
  const filteredEvents = events.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (event.name && event.name.toLowerCase().includes(query)) ||
      (event.description && event.description.toLowerCase().includes(query)) ||
      (event.location && event.location.toLowerCase().includes(query))
    );
  });

  if (loading) return <div className="loading">Loading events...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="home">
      <div className="home-header">
        <h1>Upcoming Events</h1>
        <button className="admin-btn" onClick={() => navigate('/admin/events')}>
          Admin Panel
        </button>
      </div>

      {searchQuery && (
        <div className="search-results-info">
          <p>
            {filteredEvents.length > 0
              ? `Found ${filteredEvents.length} result(s) for "${searchQuery}"`
              : `No results found for "${searchQuery}"`}
          </p>
          <button onClick={() => navigate('/')} className="clear-search-btn">
            Clear search
          </button>
        </div>
      )}

      <div className="events-grid">
        {filteredEvents.map(event => (
          <div key={event.id} className="event-card" onClick={() => navigate(`/events/${event.id}`)}>
            <img 
              src={event.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'} 
              alt={event.name} 
              className="event-image" 
            />
            <div className="event-info">
              <h2>{event.name}</h2>
              <p className="event-description">{event.description}</p>
              <p className="event-location">📍 {event.location}</p>
              <p className="event-time">🕒 {new Date(event.startTime).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {filteredEvents.length === 0 && !searchQuery && events.length === 0 && (
          <p className="no-events">No events available.</p>
        )}
      </div>
    </div>
  );
};

export default Home;
