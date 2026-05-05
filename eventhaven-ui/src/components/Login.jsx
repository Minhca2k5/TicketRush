import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogIn, Lock, Mail, Ticket } from 'lucide-react';
import { getRoleFromToken } from '../lib/auth';
import './Auth.css';

const API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL || 'http://localhost:8080';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    let response;
    try {
      response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Login failed');
      setSubmitting(false);
      return;
    }

    if (!response.data.success) {
      setError(response.data.error || 'Login failed');
      setSubmitting(false);
      return;
    }

    const token = response.data.data.token;
    const role = getRoleFromToken(token) || 'CUSTOMER';
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);

    const fallbackPath = role === 'ADMIN' ? '/admin' : '/';
    navigate(location.state?.from?.pathname || fallbackPath, { replace: true });
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
            <h1>Your next event starts here.</h1>
            <p>Sign in to browse events, manage seats, and keep your booking session ready across TicketRush.</p>
          </div>
          <div className="auth-stats">
            <div className="auth-stat"><strong>Events</strong><span>Browse live listings</span></div>
            <div className="auth-stat"><strong>Seats</strong><span>Pick with confidence</span></div>
            <div className="auth-stat"><strong>Admin</strong><span>Tools when allowed</span></div>
          </div>
        </aside>

        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Use your TicketRush account to continue.</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login-username">Username</label>
              <div className="auth-input">
                <Mail />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <div className="auth-input">
                <Lock />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button className="auth-submit" type="submit" disabled={submitting}>
              <LogIn size={18} />
              <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>

          <p className="auth-switch">
            New to TicketRush? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Login;
