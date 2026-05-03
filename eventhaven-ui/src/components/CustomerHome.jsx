import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CustomerHome.css';

/* ── SVG icons ── */
const Ic = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PATHS = {
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  calendar:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  pin:       'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  users:     'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z',
  arrow:     'M5 12h14m-7-7l7 7-7 7',
  user:      'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  mail:      'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone:     'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  location:  'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  logout:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
};

/* ── Category config ── */
const CATEGORIES = [
  { id: 'all', label: 'All Events' },
  { id: 'music', label: 'Music' },
  { id: 'sports', label: 'Sports' },
  { id: 'theater', label: 'Theater' },
  { id: 'conference', label: 'Conference' },
];

const CATEGORY_EMOJIS = {
  music: '🎵', sports: '🏆', theater: '🎭', conference: '💻', default: '🎟️'
};

const CATEGORY_GRADS = {
  music: 'grad-music', sports: 'grad-sports', theater: 'grad-theater',
  conference: 'grad-conference', default: 'grad-default'
};

function guessCategory(event) {
  const name = (event.name || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const text = name + ' ' + desc;
  if (text.includes('music') || text.includes('concert') || text.includes('festival') || text.includes('jazz')) return 'music';
  if (text.includes('sport') || text.includes('marathon') || text.includes('championship') || text.includes('league')) return 'sports';
  if (text.includes('theater') || text.includes('play') || text.includes('comedy') || text.includes('broadway')) return 'theater';
  if (text.includes('conference') || text.includes('summit') || text.includes('tech') || text.includes('web')) return 'conference';
  return 'default';
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPrice(event) {
  // Try to get minimum price from event data, fall back to placeholder
  if (event.minPrice) return `$${event.minPrice}`;
  return '$45';
}

/* ── Navbar ── */
function CustomerNav({ onLogout, onExplore, searchQuery, setSearchQuery }) {
  return (
    <nav className="ch-nav">
      <a className="ch-nav-logo" href="/">
        <div className="ch-nav-logo-box">TR</div>
        <span className="ch-nav-logo-name">TicketRush</span>
      </a>

      <div className="ch-nav-search">
        <Ic d={PATHS.search} size={15} />
        <input
          placeholder="Search events..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="ch-nav-right">
        <button className="ch-nav-link" onClick={onExplore}>Browse</button>
        <button className="ch-nav-tickets">
          My Tickets
          <span className="ch-nav-badge">0</span>
        </button>
        <button className="ch-nav-user-btn" onClick={onLogout} title="Logout">
          <Ic d={PATHS.user} size={16} />
        </button>
      </div>
    </nav>
  );
}

/* ── Hero ── */
function HeroSection({ featuredEvent, onExplore, onGetTickets }) {
  return (
    <section className="ch-hero">
      <div className="ch-hero-left">
        <h1 className="ch-hero-title">
          Discover Your Next<br />
          <span className="ch-hero-title-accent">Great Event</span>
        </h1>
        <p className="ch-hero-desc">
          Browse and book tickets to the most exciting events in your
          area. From concerts and sports to theater and conferences.
        </p>
        <div className="ch-hero-btns">
          <button className="ch-btn-primary" onClick={onExplore}>Explore Events</button>
          <button className="ch-btn-outline">Learn More</button>
        </div>
        <div className="ch-hero-stats">
          <div>
            <div className="ch-hero-stat-value">12K+</div>
            <div className="ch-hero-stat-label">Active Events</div>
          </div>
          <div>
            <div className="ch-hero-stat-value">500K+</div>
            <div className="ch-hero-stat-label">Happy Attendees</div>
          </div>
          <div>
            <div className="ch-hero-stat-value">24/7</div>
            <div className="ch-hero-stat-label">Support Available</div>
          </div>
        </div>
      </div>

      <div className="ch-hero-right">
        {featuredEvent ? (
          <div className="ch-featured-card">
            <div className={`ch-card-img ${CATEGORY_GRADS[guessCategory(featuredEvent)]}`}>
              {CATEGORY_EMOJIS[guessCategory(featuredEvent)]}
            </div>
            <div className="ch-card-body">
              <p className="ch-card-tag">Featured Event</p>
              <h3 className="ch-card-title">{featuredEvent.name}</h3>
              <div className="ch-card-meta">
                <div className="ch-card-meta-row">
                  <Ic d={PATHS.calendar} size={14} />
                  {formatDate(featuredEvent.startTime)}
                </div>
                <div className="ch-card-meta-row">
                  <Ic d={PATHS.pin} size={14} />
                  {featuredEvent.location}
                </div>
                <div className="ch-card-meta-row">
                  <Ic d={PATHS.users} size={14} />
                  12,450 tickets sold
                </div>
              </div>
              <div className="ch-card-price-row">
                <span className="ch-card-price">{formatPrice(featuredEvent)}</span>
                <span className="ch-card-price-label">Starting from</span>
              </div>
              <button className="ch-card-btn" onClick={() => onGetTickets(featuredEvent.id)}>
                Get Tickets
              </button>
            </div>
          </div>
        ) : (
          <div className="ch-featured-card">
            <div className="ch-card-img grad-music">🎵</div>
            <div className="ch-card-body">
              <p className="ch-card-tag">Featured Event</p>
              <h3 className="ch-card-title">Summer Music Festival</h3>
              <div className="ch-card-meta">
                <div className="ch-card-meta-row"><Ic d={PATHS.calendar} size={14} />July 15, 2024 · 6:00 PM</div>
                <div className="ch-card-meta-row"><Ic d={PATHS.pin} size={14} />Central Park, New York, NY</div>
                <div className="ch-card-meta-row"><Ic d={PATHS.users} size={14} />12,450 tickets sold</div>
              </div>
              <div className="ch-card-price-row">
                <span className="ch-card-price">$45</span>
                <span className="ch-card-price-label">Starting from</span>
              </div>
              <button className="ch-card-btn">Get Tickets</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Event Card ── */
function EventCard({ event, onView }) {
  const cat = guessCategory(event);
  const sold = Math.floor(Math.random() * 8000) + 2000;
  const total = sold + Math.floor(Math.random() * 5000) + 2000;
  const pct = Math.min((sold / total) * 100, 100);

  return (
    <div className="ch-event-card" onClick={() => onView(event.id)}>
      <div className={`ch-event-card-img ${CATEGORY_GRADS[cat]}`}>
        {CATEGORY_EMOJIS[cat]}
      </div>
      <div className="ch-event-card-body">
        <p className="ch-event-card-cat">{cat.charAt(0).toUpperCase() + cat.slice(1)}</p>
        <h3 className="ch-event-card-name">{event.name}</h3>
        <div className="ch-event-card-meta">
          <div className="ch-event-card-meta-row">
            <Ic d={PATHS.calendar} size={13} />
            {formatDate(event.startTime)}
          </div>
          <div className="ch-event-card-meta-row">
            <Ic d={PATHS.pin} size={13} />
            {event.location}
          </div>
        </div>
        <div className="ch-progress-section">
          <div className="ch-progress-labels">
            <span>{sold.toLocaleString()} sold</span>
            <span>{total.toLocaleString()} total</span>
          </div>
          <div className="ch-progress-bar">
            <div className="ch-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="ch-event-card-footer">
          <div>
            <div className="ch-event-card-price-label">From</div>
            <div className="ch-event-card-price">{formatPrice(event)}</div>
          </div>
          <button className="ch-event-card-arrow" onClick={e => { e.stopPropagation(); onView(event.id); }}>
            <Ic d={PATHS.arrow} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Newsletter ── */
function Newsletter() {
  const [email, setEmail] = useState('');
  return (
    <div className="ch-newsletter">
      <div className="ch-newsletter-text">
        <h2>Don't miss any events</h2>
        <p>Subscribe to our newsletter for the latest event updates and exclusive offers</p>
      </div>
      <div className="ch-newsletter-form">
        <input
          className="ch-newsletter-input"
          placeholder="Enter your email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button className="ch-newsletter-btn" onClick={() => { alert('Subscribed!'); setEmail(''); }}>
          Subscribe
        </button>
      </div>
    </div>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="ch-footer">
      <div className="ch-footer-grid">
        <div>
          <div className="ch-footer-brand-logo">
            <div className="ch-footer-logo-box">TR</div>
            <span className="ch-footer-logo-name">TicketRush</span>
          </div>
          <p className="ch-footer-brand-desc">Your trusted platform for discovering and booking tickets to amazing events.</p>
          <div className="ch-footer-socials">
            {['f', 't', 'in', 'li'].map(s => (
              <button key={s} className="ch-social-btn">{s}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="ch-footer-col-title">Browse</p>
          <div className="ch-footer-links">
            {['All Events', 'Music', 'Sports', 'Theater', 'Conferences'].map(l => (
              <span key={l} className="ch-footer-link">{l}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="ch-footer-col-title">Support</p>
          <div className="ch-footer-links">
            {['Help Center', 'Contact Us', 'FAQs', 'Refund Policy'].map(l => (
              <span key={l} className="ch-footer-link">{l}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="ch-footer-col-title">Company</p>
          <div className="ch-footer-links">
            {['About Us', 'Careers', 'Blog', 'Press'].map(l => (
              <span key={l} className="ch-footer-link">{l}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="ch-footer-col-title">Contact</p>
          <div className="ch-footer-contact-item"><Ic d={PATHS.mail} size={14} />hello@ticketrush.com</div>
          <div className="ch-footer-contact-item"><Ic d={PATHS.phone} size={14} />+1 (234) 567-890</div>
          <div className="ch-footer-contact-item"><Ic d={PATHS.location} size={14} />New York, NY 10001</div>
        </div>
      </div>
      <div className="ch-footer-bottom">
        <span className="ch-footer-copyright">© 2024 TicketRush. All rights reserved.</span>
        <div className="ch-footer-bottom-links">
          <span className="ch-footer-bottom-link">Privacy Policy</span>
          <span className="ch-footer-bottom-link">Terms of Service</span>
          <span className="ch-footer-bottom-link">Cookie Policy</span>
        </div>
      </div>
    </footer>
  );
}

/* ── Main Page ── */
export default function CustomerHome() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);
  const navigate = useNavigate();
  const eventsRef = useState(null);

  useEffect(() => {
    api.get('/events')
      .then(r => {
        const payload = r.data?.data;
        // If it's paginated, it has .content, otherwise it might just be the array
        const eventsArray = payload?.content || payload || r.data || [];
        setEvents(Array.isArray(eventsArray) ? eventsArray : []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };
  const handleView = (id) => navigate(`/events/${id}`);
  const scrollToEvents = () => document.getElementById('ch-events-section')?.scrollIntoView({ behavior: 'smooth' });

  const filtered = events.filter(ev => {
    const matchCat = activeCategory === 'all' || guessCategory(ev) === activeCategory;
    const matchSearch = !searchQuery || ev.name?.toLowerCase().includes(searchQuery.toLowerCase()) || ev.location?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const visible = filtered.slice(0, visibleCount);
  const featured = events[0] || null;

  return (
    <div className="ch-root">
      <CustomerNav
        onLogout={handleLogout}
        onExplore={scrollToEvents}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <HeroSection
        featuredEvent={featured}
        onExplore={scrollToEvents}
        onGetTickets={handleView}
      />

      <section className="ch-events" id="ch-events-section">
        <div className="ch-events-header">
          <h2 className="ch-events-title">Featured Events</h2>
          <p className="ch-events-sub">Explore thousands of events happening near you</p>
        </div>

        <div className="ch-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`ch-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => { setActiveCategory(cat.id); setVisibleCount(8); }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ch-loading"><div className="ch-spinner" /> Loading events...</div>
        ) : visible.length === 0 ? (
          <div className="ch-loading">No events found.</div>
        ) : (
          <>
            <div className="ch-events-grid">
              {visible.map(ev => (
                <EventCard key={ev.id} event={ev} onView={handleView} />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div className="ch-load-more">
                <button className="ch-load-more-btn" onClick={() => setVisibleCount(v => v + 8)}>
                  Load More Events
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <Newsletter />
      <Footer />
    </div>
  );
}
