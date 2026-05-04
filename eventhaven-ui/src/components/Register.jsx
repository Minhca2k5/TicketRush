import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Lock, Mail, Ticket, UserPlus } from 'lucide-react';
import './Auth.css';

const API_BASE_URL = '';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, { username, password, email });
      if (response.data.success) {
        navigate('/login', { replace: true });
      } else {
        setError(response.data.error || 'Register failed');
      }
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Register failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-shell">
        <aside className="auth-panel">
          <div className="auth-brand">
            <span className="auth-brand-icon"><Ticket size={22} /></span>
            <span>TicketRush</span>
          </div>
          <div>
            <h1>Join TicketRush in a minute.</h1>
            <p>Create a customer account to browse events, reserve seats, and move through checkout faster.</p>
          </div>
          <div className="auth-stats">
            <div className="auth-stat"><strong>Simple</strong><span>One account</span></div>
            <div className="auth-stat"><strong>Ready</strong><span>Book faster</span></div>
            <div className="auth-stat"><strong>Events</strong><span>Track favorites</span></div>
          </div>
        </aside>

        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2>Create account</h2>
            <p>Customer accounts are active immediately after registration.</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label htmlFor="register-username">Username</label>
              <div className="auth-input">
                <UserPlus />
                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">Email</label>
              <div className="auth-input">
                <Mail />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <div className="auth-input">
                <Lock />
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button className="auth-submit" type="submit" disabled={submitting}>
              <ArrowRight size={18} />
              <span>{submitting ? 'Creating account...' : 'Create account'}</span>
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Register;
