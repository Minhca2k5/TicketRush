import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, ImageOff, MapPin, Ticket } from 'lucide-react';
import api from '../services/api';
import HeroSlider from './HeroSlider';

const inferCategory = (event) => {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  if (/conference|summit|tech/.test(text)) return 'conference';
  if (/sport|match|final|arena|championship/.test(text)) return 'sports';
  if (/theater|gala|broadway|drama/.test(text)) return 'theater';
  return 'concerts';
};

const normalizeCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (/conference|summit|tech/.test(normalized)) return 'conference';
  if (/concert|music|festival|orchestra/.test(normalized)) return 'concerts';
  if (/sport|match|final|arena|championship/.test(normalized)) return 'sports';
  if (/theater|theatre|opera|gala|drama|comedy/.test(normalized)) return 'theater';
  return normalized;
};

const inferPrice = (event, index) => {
  if (event.priceTier?.price) return event.priceTier.price;
  return 79 + index * 12;
};

const resolveEventImage = (event) =>
  event?.bannerUrl || event?.imageUrl || event?.posterUrl || event?.image || '';

const resolveEventLocation = (event) =>
  event?.location || event?.venue?.name || event?.venue?.address || 'Venue TBA';

function EventImagePlaceholder({ category }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,_rgba(255,255,255,0.35),_transparent_26%),linear-gradient(135deg,_#4f46e5,_#7c3aed_52%,_#111827)] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/25 backdrop-blur">
          <Ticket size={28} />
        </div>
        <div className="text-center">
          <p className="text-sm font-black tracking-tight">TicketRush</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">{category}</p>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = resolveEventImage(event);
  const locationText = resolveEventLocation(event);
  const formattedPrice = Number(event.price || 0).toLocaleString();
  const startTime = event.startTime ? new Date(event.startTime).toLocaleString() : 'Date TBA';

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl">
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={event.name || 'TicketRush event banner'}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <EventImagePlaceholder category={event.category || 'event'} />
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/55 to-transparent" />
        <span className="absolute left-4 top-4 inline-flex max-w-[calc(100%-2rem)] items-center rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-violet-900/20 ring-1 ring-white/25 backdrop-blur">
          {event.category || 'event'}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="min-h-[88px]">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-950">
            {event.name || 'Untitled Event'}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
            {event.description || 'More event details will be available soon.'}
          </p>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-500">
          <p className="flex items-start gap-2">
            <CalendarDays size={16} className="mt-0.5 shrink-0 text-violet-500" />
            <span className="line-clamp-1">{startTime}</span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-violet-500" />
            <span className="line-clamp-1">{locationText}</span>
          </p>
        </div>

        <div className="mt-auto pt-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Starting from</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">${formattedPrice}</p>
            </div>
            {imageFailed ? <ImageOff size={18} className="mb-1 text-slate-300" /> : null}
          </div>

          <Link
            to={`/events/${event.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition duration-200 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/35 focus:outline-none focus:ring-4 focus:ring-violet-200"
          >
            <Ticket size={16} />
            Buy Ticket
          </Link>
        </div>
      </div>
    </article>
  );
}

function EventList({ events }) {
  if (!events.length) {
    return (
      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center text-slate-500">
        No events matched your search. Try a different keyword or category.
      </div>
    );
  }

  return events.map((event) => (
    <EventCard key={event.id} event={event} />
  ));
}

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
      category: normalizeCategory(event.category || inferCategory(event)),
      price: inferPrice(event, index),
    }))
  ), [events]);

  const filteredEvents = useMemo(() => (
    normalizedEvents.filter((event) => {
      const searchableText = `${event.name || ''} ${event.description || ''} ${resolveEventLocation(event)}`.toLowerCase();
      const matchesSearch = !search || searchableText.includes(search);
      const matchesCategory = !category || normalizeCategory(event.category) === normalizeCategory(category);
      return matchesSearch && matchesCategory;
    })
  ), [normalizedEvents, search, category]);

  return (
    <div className="bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_28%),linear-gradient(180deg,_#f8faff_0%,_#eef2ff_100%)]">
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        <HeroSlider events={normalizedEvents} />

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

              <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
                {filteredEvents.length ? (
                  <EventList events={filteredEvents} />
                ) : (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center text-slate-500">
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
