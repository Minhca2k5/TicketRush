import { useEffect, useState } from 'react';
import { BadgeCheck, Cake, Mail, Shield, Sparkles, UserRound } from 'lucide-react';
import { getProfile, updateProfile } from '../services/authService';

const Profile = () => {
  const [profile, setProfile] = useState({ username: '', email: '', role: '', age: '', gender: '', emailVerified: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = await getProfile();
        setProfile({
          username: user.username || '',
          email: user.email || '',
          role: user.role || '',
          age: user.age || '',
          gender: user.gender || '',
          emailVerified: Boolean(user.emailVerified),
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
      const user = await updateProfile({
        email: profile.email,
        age: profile.age ? Number(profile.age) : null,
        gender: profile.gender || null,
      });
      setProfile((current) => ({ ...current, age: user.age || '', gender: user.gender || '', email: user.email || '', emailVerified: Boolean(user.emailVerified) }));
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
      <div className="profile-hero">
        <div className="profile-hero-copy">
          <span>Account</span>
          <h1>Profile settings</h1>
          <p>Keep your contact and demographic details up to date so booking and dashboard data stay accurate.</p>
        </div>

        <div className="profile-hero-stats">
          <div className="profile-stat-card">
            <UserRound size={18} />
            <div>
              <strong>{profile.username || 'User'}</strong>
              <span>Username</span>
            </div>
          </div>
          <div className="profile-stat-card">
            <Shield size={18} />
            <div>
              <strong>{profile.role || 'CUSTOMER'}</strong>
              <span>Role</span>
            </div>
          </div>
          <div className="profile-stat-card">
            <BadgeCheck size={18} />
            <div>
              <strong>{profile.emailVerified ? 'Verified' : 'Pending verification'}</strong>
              <span>Email status</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-content">
        <aside className="profile-summary">
          <div className="profile-avatar">{profile.username ? profile.username.slice(0, 2).toUpperCase() : 'TR'}</div>
          <div className="profile-summary-copy">
            <h2>{profile.username || 'Customer account'}</h2>
            <p>{profile.email || 'Your email will appear here once loaded.'}</p>
          </div>

          <div className="profile-summary-list">
            <div>
              <Mail size={16} />
              <div>
                <span>Email</span>
                <strong>{profile.email || 'Not set'}</strong>
              </div>
            </div>
            <div>
              <Cake size={16} />
              <div>
                <span>Age</span>
                <strong>{profile.age || 'Not provided'}</strong>
              </div>
            </div>
            <div>
              <Sparkles size={16} />
              <div>
                <span>Gender</span>
                <strong>{profile.gender || 'Prefer not to say'}</strong>
              </div>
            </div>
          </div>
        </aside>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="profile-form-header">
            <h3>Editable details</h3>
            <p>Username and role are read-only. Update the rest of your profile below.</p>
          </div>

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
            <label className="profile-grid-span-2">
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
      </div>
    </section>
  );
};

export default Profile;
