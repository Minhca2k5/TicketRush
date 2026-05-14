import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Ticket, UserPlus } from 'lucide-react';
import { registerAccount } from '../services/authService';
import './Auth.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (value) => {
    if (!value) {
      return 'Email is required';
    }

    if (!EMAIL_PATTERN.test(value)) {
      return 'Please enter a valid email address';
    }

    return '';
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);

    if (nextEmailError) {
      return;
    }

    setSubmitting(true);

    try {
      await registerAccount({ username, password, email });
      navigate('/verify-email', { replace: true, state: { email } });
    } catch (error) {
      const backendMessage = error.response?.data?.error || error.message || 'Register failed';
      if (error.response?.status === 409 && /email/i.test(backendMessage)) {
        setEmailError('This email is already registered');
        setError('');
      } else {
        setError(backendMessage);
      }
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
            <p>We will email you a one-time code. Your account becomes active after verification.</p>
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
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setEmail(nextValue);
                    setEmailError(validateEmail(nextValue));
                  }}
                  onBlur={(e) => setEmailError(validateEmail(e.target.value))}
                  autoComplete="email"
                  aria-invalid={Boolean(emailError)}
                  required
                />
              </div>
              {emailError && <p className="auth-field-error">{emailError}</p>}
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
