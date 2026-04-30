import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AdminEvents.css';

const AdminEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startTime: '',
    imageUrl: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [seatForm, setSeatForm] = useState({
    eventId: '',
    batches: [
      { zoneName: '', zoneDescription: '', price: '', rows: '', seatsPerRow: '' },
    ]
  });
  const [seatMessage, setSeatMessage] = useState('');
  const [generateDefaultSeats, setGenerateDefaultSeats] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let savedEvent;
      if (editingId) {
        savedEvent = await api.put(`/events/${editingId}`, formData);
      } else {
        savedEvent = await api.post('/events', formData);
      }
      
      resetForm();
      fetchEvents();

      // Tự động tạo seats mặc định nếu là tạo mới và checkbox được tick
      if (!editingId && generateDefaultSeats && savedEvent.data?.id) {
        try {
          const defaultPayload = {
            eventId: savedEvent.data.id,
            batches: [
              { zoneName: 'VIP', zoneDescription: 'VIP Zone', price: 500000, rows: 5, seatsPerRow: 5 },
              { zoneName: 'Standard', zoneDescription: 'Standard Zone', price: 200000, rows: 5, seatsPerRow: 10 }
            ]
          };
          await api.post(`/events/${savedEvent.data.id}/seats/batch`, defaultPayload);
          alert('Event created with default seats!');
        } catch (seatErr) {
          alert('Event created but failed to generate seats: ' + (seatErr.response?.data?.message || seatErr.message));
        }
      } else if (!editingId) {
        alert('Event created! Remember to generate seats manually.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  };

  const handleEdit = (event) => {
    setFormData({
      name: event.name,
      description: event.description,
      location: event.location,
      startTime: event.startTime.slice(0, 16), // format for datetime-local
      imageUrl: event.imageUrl
    });
    setEditingId(event.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      fetchEvents();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      startTime: '',
      imageUrl: ''
    });
    setEditingId(null);
    setGenerateDefaultSeats(false);
  };

  // Seat generation
  const addSeatBatch = () => {
    setSeatForm(prev => ({
      ...prev,
      batches: [...prev.batches, { zoneName: '', zoneDescription: '', price: '', rows: '', seatsPerRow: '' }]
    }));
  };

  const removeSeatBatch = (index) => {
    setSeatForm(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== index)
    }));
  };

  const handleSeatBatchChange = (index, field, value) => {
    setSeatForm(prev => {
      const newBatches = [...prev.batches];
      newBatches[index] = { ...newBatches[index], [field]: value };
      return { ...prev, batches: newBatches };
    });
  };

  const handleGenerateSeats = async (e) => {
    e.preventDefault();
    setError(null);
    setSeatMessage('');
    try {
      const payload = {
        eventId: parseInt(seatForm.eventId),
        batches: seatForm.batches.map(b => ({
          zoneName: b.zoneName,
          zoneDescription: b.zoneDescription || b.zoneName + ' Zone',
          price: parseFloat(b.price),
          rows: parseInt(b.rows),
          seatsPerRow: parseInt(b.seatsPerRow)
        }))
      };
      await api.post(`/events/${seatForm.eventId}/seats/batch`, payload);
      setSeatMessage('Seats generated successfully!');
      setSeatForm({ eventId: '', batches: [] });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate seats');
    }
  };

  const handleGenerateDefaultSeats = async (eventId) => {
    setError(null);
    setSeatMessage('');
    try {
      const payload = {
        eventId: parseInt(eventId),
        batches: [
          { zoneName: 'VIP', zoneDescription: 'VIP Zone', price: 500000, rows: 5, seatsPerRow: 5 },
          { zoneName: 'Standard', zoneDescription: 'Standard Zone', price: 200000, rows: 5, seatsPerRow: 10 }
        ]
      };
      await api.post(`/events/${eventId}/seats/batch`, payload);
      setSeatMessage('Default seats generated!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate seats');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="admin-events">
      <h1>Admin - Manage Events</h1>

      <div className="form-container">
        <h2>{editingId ? 'Edit Event' : 'Create New Event'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Start Time</label>
            <input
              type="datetime-local"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Image URL</label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div className="form-actions">
            <button type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && (
              <button type="button" className="cancel-btn" onClick={resetForm}>Cancel</button>
            )}
          </div>

          {/* Checkbox tạo seats tự động */}
          {!editingId && (
            <div className="form-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={generateDefaultSeats}
                  onChange={(e) => setGenerateDefaultSeats(e.target.checked)}
                />
                Tạo seats mặc định (VIP: 5x5, Standard: 5x10) sau khi tạo event
              </label>
            </div>
          )}
        </form>
      </div>

      {/* Seat Generation Section */}
      <div className="seat-generation">
        <h2>Generate Seats for Event</h2>
        <div className="form-group">
          <label>Select Event</label>
          <select
            value={seatForm.eventId}
            onChange={(e) => setSeatForm(prev => ({ ...prev, eventId: e.target.value }))}
          >
            <option value="">-- Choose an event --</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {seatForm.eventId && (
          <>
            <div className="batches-container">
              {seatForm.batches.map((batch, idx) => (
                <div key={idx} className="batch-card">
                  <h4>Zone {idx + 1}</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Zone Name</label>
                      <input
                        type="text"
                        value={batch.zoneName}
                        onChange={(e) => handleSeatBatchChange(idx, 'zoneName', e.target.value)}
                        placeholder="e.g. VIP"
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        value={batch.zoneDescription}
                        onChange={(e) => handleSeatBatchChange(idx, 'zoneDescription', e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Price (VND)</label>
                      <input
                        type="number"
                        value={batch.price}
                        onChange={(e) => handleSeatBatchChange(idx, 'price', e.target.value)}
                        placeholder="50000"
                      />
                    </div>
                    <div className="form-group">
                      <label>Rows</label>
                      <input
                        type="number"
                        value={batch.rows}
                        onChange={(e) => handleSeatBatchChange(idx, 'rows', e.target.value)}
                        placeholder="5"
                      />
                    </div>
                    <div className="form-group">
                      <label>Seats/Row</label>
                      <input
                        type="number"
                        value={batch.seatsPerRow}
                        onChange={(e) => handleSeatBatchChange(idx, 'seatsPerRow', e.target.value)}
                        placeholder="10"
                      />
                    </div>
                  </div>
                  {seatForm.batches.length > 1 && (
                    <button type="button" className="remove-btn" onClick={() => removeSeatBatch(idx)}>Remove Zone</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="add-zone-btn" onClick={addSeatBatch}>+ Add Another Zone</button>
            <div className="quick-action">
              <button type="button" className="default-btn" onClick={() => handleGenerateDefaultSeats(seatForm.eventId)}>
                Generate Default Seats (VIP + Standard)
              </button>
            </div>
            <button type="submit" className="generate-btn" onClick={handleGenerateSeats}>Generate Seats</button>
            {seatMessage && <p className="message success">{seatMessage}</p>}
          </>
        )}
      </div>

      <div className="events-list">
        <h2>Existing Events</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Location</th>
              <th>Start Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.id}>
                <td>{event.id}</td>
                <td>{event.name}</td>
                <td>{event.location}</td>
                <td>{new Date(event.startTime).toLocaleString()}</td>
                <td>
                  <button className="edit-btn" onClick={() => handleEdit(event)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(event.id)}>Delete</button>
                  <button className="view-btn" onClick={() => navigate(`/events/${event.id}`)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminEvents;
