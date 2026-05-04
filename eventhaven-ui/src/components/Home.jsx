import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, MapPin, Sparkles, Ticket } from 'lucide-react';
import api from '../services/api';

const inferCategory = (event) => {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  if (/sport|match|final|arena|championship/.test(text)) return 'sports';
  if (/theater|gala|broadway|drama/.test(text)) return 'theater';
  return 'concerts';
};

const inferPrice = (event, index) => {
  if (event.priceTier?.price) return event.priceTier.price;
  return 79 + index * 12;
};

const resolveEventImage = (event) =>
  event?.bannerUrl || event?.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80';

const resolveEventLocation = (event) =>
  event?.location || event?.venue?.name || event?.venue?.address || 'Venue TBA';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const location = useLocation();

  const search = new URLSearchParams(location.search).get('search')?.toLowerCase() || '';
  const category = new URLSearchParams(location.search).get('category')?.toLowerCase() || '';

  const loadEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await api.get('/events');
      const payload = response.data?.data?.content || response.data?.data || response.data || [];

      setEvents(Array.isArray(payload) ? payload : []);
      setLoadError('');
    } catch {
      setEvents([]);
      setLoadError('Unable to load events from the Event Service right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const guardedLoad = async () => {
      try {
        await loadEvents();
      } finally {
        if (!active) {
          return;
        }
      }
    };

    guardedLoad();

    const onFocus = () => {
      if (active) {
        loadEvents({ silent: true }).catch(() => {});
      }
    };

    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [loadEvents]);

  useEffect(() => {
    if (!loadError) {
      return undefined;
    }

    const retry = window.setTimeout(() => {
      loadEvents({ silent: true }).catch(() => {});
    }, 4000);

    return () => window.clearTimeout(retry);
  }, [loadError, loadEvents]);

  const normalizedEvents = useMemo(() => (
    events.map((event, index) => ({
      ...event,
      category: event.category || inferCategory(event),
      price: inferPrice(event, index),
    }))
  ), [events]);

  const filteredEvents = useMemo(() => (
    normalizedEvents.filter((event) => {
      const searchableText = `${event.name || ''} ${event.description || ''} ${resolveEventLocation(event)}`.toLowerCase();
      const matchesSearch = !search || searchableText.includes(search);
      const matchesCategory = !category || event.category === category;
      return matchesSearch && matchesCategory;
    })
  ), [normalizedEvents, search, category]);

  const trendingEvent = filteredEvents[0] || normalizedEvents[0] || null;

  return (
    <div className="bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_28%),linear-gradient(180deg,_#f8faff_0%,_#eef2ff_100%)]">
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-slate-950 text-white shadow-[0_30px_80px_rgba(76,29,149,0.28)]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8 md:p-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-violet-200">
                <Sparkles size={16} />
                Trending Event
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight md:text-6xl">
                {trendingEvent?.name || 'Live events will appear here once the Event Service has data.'}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                {trendingEvent?.description || 'Connect the frontend to seeded or newly created events, then customers will be able to browse and book real listings.'}
              </p>
              <div className="mt-8 flex flex-wrap gap-5 text-sm text-slate-300">
                {trendingEvent ? (
                  <>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays size={16} className="text-violet-300" />
                      {new Date(trendingEvent.startTime).toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={16} className="text-violet-300" />
                      {resolveEventLocation(trendingEvent)}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2 text-violet-100/90">
                    <MapPin size={16} className="text-violet-300" />
                    No featured event available yet
                  </span>
                )}
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                {trendingEvent ? (
                  <>
                    <Link
                      to={`/events/${trendingEvent.id}`}
                      className="rounded-full bg-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
                    >
                      Book Now
                    </Link>
                    <span className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200">
                      From ${Number(trendingEvent.price).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full border border-amber-300/30 bg-white/5 px-5 py-3 text-sm font-semibold text-amber-100">
                    Add or seed events to enable booking
                  </span>
                )}
              </div>
            </div>
            <div className="relative min-h-[320px]">
              <img
                src={resolveEventImage(trendingEvent)}
                alt={trendingEvent?.name || 'TicketRush featured event placeholder'}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/20 to-transparent" />
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-500">Hot Trends</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Discover your next live moment</h2>
            </div>
            {(search || category) && (
              <p className="text-sm text-slate-500">
                Showing {filteredEvents.length} result(s){search ? ` for "${search}"` : ''}{category ? ` in ${category}` : ''}.
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-8 rounded-[28px] border border-slate-200 bg-white/80 p-10 text-center text-slate-500 shadow-sm">
              Loading events...
            </div>
          ) : (
            <>
              {loadError ? (
                <div className="mt-8 flex flex-col gap-3 rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-800 shadow-sm md:flex-row md:items-center md:justify-between">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => loadEvents()}
                    className="inline-flex w-fit items-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    Retry now
                  </button>
                </div>
              ) : null}

              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {filteredEvents.map((event) => (
                  <article
                    key={event.id}
                    className="group overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_50px_rgba(148,163,184,0.18)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_70px_rgba(124,58,237,0.18)]"
                  >
                    <div className="relative h-56 overflow-hidden">
                      <img src={resolveEventImage(event)} alt={event.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/80 to-transparent" />
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-violet-700">
                        {event.category}
                      </span>
                    </div>
                    <div className="space-y-4 p-5">
                      <div>
                        <h3 className="text-xl font-black tracking-tight text-slate-900">{event.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{event.description}</p>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p className="inline-flex items-center gap-2">
                          <CalendarDays size={16} className="text-violet-500" />
                          {new Date(event.startTime).toLocaleString()}
                        </p>
                        <p className="inline-flex items-center gap-2">
                          <MapPin size={16} className="text-violet-500" />
                          {resolveEventLocation(event)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Starting from</p>
                          <p className="mt-1 text-2xl font-black text-slate-900">${Number(event.price).toLocaleString()}</p>
                        </div>
                        <Link
                          to={`/events/${event.id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
                        >
                          <Ticket size={16} />
                          Buy Ticket
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}

                {!filteredEvents.length && (
                  <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center text-slate-500">
                    {normalizedEvents.length
                      ? 'No events matched your search. Try a different keyword or category.'
                      : 'No live events are available yet. Seed or create events in the Event Service to populate this page.'}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
