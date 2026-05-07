import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Sparkles, Ticket } from 'lucide-react';

const HERO_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80';

const resolveEventImage = (event) =>
  event?.bannerUrl || event?.imageUrl || event?.posterUrl || event?.image || HERO_IMAGE_FALLBACK;

const resolveEventLocation = (event) =>
  event?.location || event?.venue?.name || event?.venue?.address || 'Venue TBA';

const formatDateTime = (value) => {
  if (!value) return 'Date TBA';
  return new Date(value).toLocaleString();
};

const getTrendingScore = (event) =>
  Number(event?.viewCount || event?.views || event?.ticketsSold || event?.soldCount || 0);

const EXCLUDED_SLIDER_EVENT_NAMES = new Set([
  'concert: rock universe 2026',
]);

export default function HeroSlider({ events = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const trendingEvents = useMemo(() => {
    const source = Array.isArray(events) ? events : [];
    return [...source]
      .filter((event) => !EXCLUDED_SLIDER_EVENT_NAMES.has(String(event?.name || '').trim().toLowerCase()))
      .sort((a, b) => getTrendingScore(b) - getTrendingScore(a))
      .slice(0, 5);
  }, [events]);

  const slides = trendingEvents.length
    ? trendingEvents
    : [{
        id: 'placeholder',
        name: 'Live events will appear here once the Event Service has data.',
        description: 'Connect the frontend to seeded or newly created events, then customers will be able to browse and book real listings.',
        startTime: null,
        location: 'No featured event available yet',
        price: 0,
      }];

  const totalSlides = slides.length;
  const canNavigate = totalSlides > 1;

  useEffect(() => {
    if (activeIndex > totalSlides - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, totalSlides]);

  useEffect(() => {
    if (isPaused || !canNavigate) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % totalSlides);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [canNavigate, isPaused, totalSlides]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + totalSlides) % totalSlides);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % totalSlides);
  };

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-white/70 bg-slate-950 text-white shadow-[0_30px_80px_rgba(76,29,149,0.28)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative min-h-[520px] md:min-h-[500px]">
        {slides.map((event, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={event.id || `${event.name}-${index}`}
              className={`absolute inset-0 grid transition-all duration-700 ease-out lg:grid-cols-[1.05fr_0.95fr] ${
                isActive ? 'z-10 translate-x-0 opacity-100' : 'z-0 translate-x-6 opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/55 to-black/10 lg:bg-gradient-to-r lg:from-black/75 lg:via-black/45 lg:to-transparent" />

              <div className="relative z-10 flex max-w-3xl flex-col justify-center px-12 pb-28 pt-16 sm:px-14 md:px-20 md:pb-24 lg:pl-24 lg:pr-12">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-violet-200 ring-1 ring-white/10 backdrop-blur">
                  <Sparkles size={16} />
                  Trending Event
                </div>

                <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                  {event.name || 'Untitled Event'}
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  {event.description || 'More event details will be available soon.'}
                </p>

                <div className="mt-8 flex flex-wrap gap-5 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays size={16} className="text-violet-300" />
                    {formatDateTime(event.startTime)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin size={16} className="text-violet-300" />
                    {resolveEventLocation(event)}
                  </span>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-4">
                  {event.id !== 'placeholder' ? (
                    <Link
                      to={`/events/${event.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400 focus:outline-none focus:ring-4 focus:ring-violet-300/30"
                    >
                      <Ticket size={16} />
                      Book Now
                    </Link>
                  ) : (
                    <span className="rounded-full border border-amber-300/30 bg-white/5 px-5 py-3 text-sm font-semibold text-amber-100">
                      Add or seed events to enable booking
                    </span>
                  )}

                  {Number(event.price) > 0 ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200">
                      From ${Number(event.price).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="absolute inset-0 z-0 lg:relative">
                <img
                  src={resolveEventImage(event)}
                  alt={event.name || 'TicketRush featured event'}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          );
        })}
      </div>

      {canNavigate ? (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:scale-105 hover:bg-white/25 hover:ring-white/40 md:left-4 md:h-12 md:w-12 lg:left-5"
            aria-label="Previous featured event"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            onClick={goToNext}
            className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-md transition hover:scale-105 hover:bg-white/25 hover:ring-white/40 md:right-4 md:h-12 md:w-12 lg:right-5"
            aria-label="Next featured event"
          >
            <ChevronRight size={22} />
          </button>

          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-black/20 px-3 py-2 ring-1 ring-white/10 backdrop-blur-md">
            {slides.map((event, index) => (
              <button
                key={event.id || `${event.name}-dot-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  index === activeIndex ? 'w-9 bg-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.65)]' : 'w-2.5 bg-white/45 hover:bg-white/75'
                }`}
                aria-label={`Go to featured event ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
