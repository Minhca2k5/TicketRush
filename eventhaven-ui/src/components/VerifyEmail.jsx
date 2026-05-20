import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, RotateCcw, ShieldCheck, Ticket } from 'lucide-react';
import { resendVerificationCode, verifyEmail } from '../services/authService';
import './Auth.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_SECONDS = 60;

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(CODE_TTL_SECONDS);

  const emailError = useMemo(() => {
    if (!email) {
      return 'Email is required';
    }

    return EMAIL_PATTERN.test(email) ? '' : 'Please enter a valid email address';
  }, [email]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsRemaining]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (emailError) {
      setError(emailError);
      return;
    }

    if (!code.trim()) {
      setError('Verification code is required');
      return;
    }

    setVerifying(true);

    try {
      await verifyEmail({ email, code: code.trim() });
      setMessage('Email verified. You can now sign in.');
      setTimeout(() => navigate('/login', { replace: true }), 800);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');

    if (emailError) {
      setError(emailError);
      return;
    }

    setSending(true);

    try {
      await resendVerificationCode({ email });
      setCode('');
      setSecondsRemaining(CODE_TTL_SECONDS);
      setMessage('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to resend verification code');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-shell verification-shell">
        <aside className="auth-panel">
          <div className="auth-brand">
            <span className="auth-brand-icon"><Ticket size={22} /></span>
            <span>TicketRush</span>
          </div>
          <div>
            <h1>Check your inbox.</h1>
            <p>We sent a one-time verification code to confirm your email before the account becomes active.</p>
          </div>
          <div className="auth-stats">
            <div className="auth-stat"><strong>Step 1</strong><span>Register account</span></div>
            <div className="auth-stat"><strong>Step 2</strong><span>Verify email</span></div>
            <div className="auth-stat"><strong>Step 3</strong><span>Sign in</span></div>
          </div>
        </aside>

        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2>Verify email</h2>
            <p>Enter the 6-digit code sent to your email to activate your account.</p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <form className="auth-form" onSubmit={handleVerify}>
            <div className="auth-field">
              <label htmlFor="verify-email">Email</label>
              <div className="auth-input">
                <Mail />
                <input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="verify-code">Verification code</label>
              <div className="auth-input">
                <ShieldCheck />
                <input
                  id="verify-code"
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
              <p className={secondsRemaining > 0 ? 'auth-field-hint' : 'auth-field-error'}>
                {secondsRemaining > 0
                  ? `Code expires in ${secondsRemaining}s. You can try up to 5 times.`
                  : 'Code expired. Resend a new code to continue.'}
              </p>
            </div>

            <button className="auth-submit" type="submit" disabled={verifying}>
              <CheckCircle2 size={18} />
              <span>{verifying ? 'Verifying...' : 'Verify email'}</span>
            </button>

            <button className="auth-secondary" type="button" onClick={handleResend} disabled={sending}>
              <RotateCcw size={18} />
              <span>{sending ? 'Sending...' : 'Resend code'}</span>
            </button>
          </form>

          <p className="auth-switch">
            Already verified? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default VerifyEmail;
