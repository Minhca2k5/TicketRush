import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { SeatSelector } from './SeatSelector';

const EventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${id}`);
        setEvent(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch event');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading event...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!event) return null;

  return (
    <SeatSelector
      event={{
        name: event.name,
        location: event.location,
        startTime: event.startTime,
        imageUrl: event.imageUrl,
      }}
      initialSeats={event.seats || []}
    />
  );
};

export default EventDetail;
