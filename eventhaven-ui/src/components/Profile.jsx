import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthToken } from '../lib/auth';

const Profile = () => {
  const [profile, setProfile] = useState({ username: '', email: '', role: '', age: '', gender: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('/auth/profile', {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        const user = response.data.data;
        setProfile({
          username: user.username || '',
          email: user.email || '',
          role: user.role || '',
          age: user.age || '',
          gender: user.gender || '',
        });
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.put(
        '/auth/profile',
        {
          email: profile.email,
          age: profile.age ? Number(profile.age) : null,
          gender: profile.gender || null,
        },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } },
      );
      const user = response.data.data;
      setProfile((current) => ({ ...current, age: user.age || '', gender: user.gender || '', email: user.email || '' }));
      setMessage('Profile updated');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="profile-page">Loading profile...</div>;
  }

  return (
    <section className="profile-page">
      <div className="profile-header">
        <span>Account</span>
        <h1>Profile settings</h1>
        <p>Keep demographic details updated so dashboard insights reflect real customer data.</p>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        {error && <div className="profile-alert error">{error}</div>}
        {message && <div className="profile-alert success">{message}</div>}

        <div className="profile-grid">
          <label>
            Username
            <input value={profile.username} disabled />
          </label>
          <label>
            Role
            <input value={profile.role} disabled />
          </label>
          <label>
            Email
            <input
              type="email"
              value={profile.email}
              onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>
          <label>
            Age
            <input
              type="number"
              min="1"
              max="120"
              value={profile.age}
              onChange={(event) => setProfile((current) => ({ ...current, age: event.target.value }))}
            />
          </label>
          <label>
            Gender
            <select
              value={profile.gender}
              onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))}
            >
              <option value="">Prefer not to say</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
        </div>

        <button className="profile-submit" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </section>
  );
};

export default Profile;
