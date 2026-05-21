import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ImageOff, MapPin, MessageSquare, Search, SlidersHorizontal, Ticket, X } from 'lucide-react';
import api from '../services/api';
import { searchEvents } from '../services/eventService';
import { getEventPriceInfo } from '../lib/event-pricing';
import { getAdminEventStatus, isCustomerVisibleEvent, isEventBookable, isEventPast } from '../lib/event-status';

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 400;

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Events' },
  { id: 'concerts', label: 'Music' },
  { id: 'theater', label: 'Theater' },
  { id: 'sports', label: 'Sports' },
  { id: 'festival', label: 'Festival' },
  { id: 'conference', label: 'Conference' },
];

const SORT_OPTIONS = [
  { id: 'date', label: 'Date (Soonest)' },
  { id: 'name', label: 'Name (A-Z)' },
  { id: 'price', label: 'Price (Low → High)' },
];

const inferCategory = (event) => {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  if (/conference|summit|tech/.test(text)) return 'conference';
  if (/festival/.test(text)) return 'festival';
  if (/sport|match|final|arena|championship/.test(text)) return 'sports';
  if (/theater|theatre|opera|gala|drama|comedy/.test(text)) return 'theater';
  return 'concerts';
};

const normalizeCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (/conference|summit|tech/.test(normalized)) return 'conference';
  if (/festival/.test(normalized)) return 'festival';
  if (/concert|music|orchestra/.test(normalized)) return 'concerts';
  if (/sport|match|final|arena|championship/.test(normalized)) return 'sports';
  if (/theater|theatre|opera|gala|drama|comedy/.test(normalized)) return 'theater';
  return normalized;
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
  const priceInfo = getEventPriceInfo(event);
  const startTime = event.startTime ? new Date(event.startTime).toLocaleString() : 'Date TBA';
  const isPast = isEventPast(event);
  const canBook = isEventBookable(event);
  const eventStatus = getAdminEventStatus(event);

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
        {isPast && (
          <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-slate-600/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-900/20 ring-1 ring-white/25 backdrop-blur">
            Ended
          </span>
        )}
        {!isPast && !canBook && (
          <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-amber-900/20 ring-1 ring-white/25 backdrop-blur">
            {eventStatus}
          </span>
        )}
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
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{priceInfo.helper}</p>
              <p className={`mt-1 text-2xl font-black tracking-tight ${!canBook ? 'text-slate-500' : priceInfo.state === 'sold_out' ? 'text-rose-600' : 'text-slate-950'}`}>
                {isPast ? 'Ended' : canBook ? priceInfo.label : 'Coming Soon'}
              </p>
            </div>
            {imageFailed ? <ImageOff size={18} className="mb-1 text-slate-300" /> : null}
          </div>

          <Link
            to={`/events/${event.id}`}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition duration-200 focus:outline-none focus:ring-4 ${
              !canBook
                ? 'bg-gradient-to-r from-slate-600 to-slate-700 shadow-slate-500/25 hover:from-slate-500 hover:to-slate-600 hover:shadow-slate-500/35 focus:ring-slate-200'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/35 focus:ring-violet-200'
            }`}
          >
            {isPast ? (
              <>
                <MessageSquare size={16} />
                View Reviews
              </>
            ) : !canBook ? (
              <>
                <Ticket size={16} />
                View Details
              </>
            ) : (
              <>
                <Ticket size={16} />
                Buy Ticket
              </>
            )}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function AllEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState(() => normalizeCategory(searchParams.get('category') || 'all') || 'all');
  const [currentPage, setCurrentPage] = useState(() => Math.max(Number(searchParams.get('page') || 1), 1));
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'date');
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(() => searchParams.get('to') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const debounceRef = useRef(null);

  const loadEvents = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const searchQ = params.q ?? searchQuery;
      const searchCat = params.category ?? activeCategory;
      const searchSort = params.sort ?? sortBy;
      const searchFrom = params.from ?? dateFrom;
      const searchTo = params.to ?? dateTo;

      // Use server-side search if any filters are active
      const hasFilters = searchQ || (searchCat && searchCat !== 'all') || searchFrom || searchTo;
      let payload;

      if (hasFilters) {
        payload = await searchEvents({
          q: searchQ || undefined,
          category: searchCat || undefined,
          from: searchFrom ? new Date(searchFrom).toISOString() : undefined,
          to: searchTo ? new Date(searchTo + 'T23:59:59').toISOString() : undefined,
          sort: searchSort,
        });
      } else {
        const response = await api.get('/events');
        payload = response.data?.data?.content || response.data?.data || response.data || [];
      }

      setEvents(Array.isArray(payload) ? payload : []);
      setLoadError('');
    } catch {
      setEvents([]);
      setLoadError('Unable to load events from the Event Service right now.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeCategory, sortBy, dateFrom, dateTo]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
    setActiveCategory(normalizeCategory(searchParams.get('category') || 'all') || 'all');
    setCurrentPage(Math.max(Number(searchParams.get('page') || 1), 1));
    setSortBy(searchParams.get('sort') || 'date');
    setDateFrom(searchParams.get('from') || '');
    setDateTo(searchParams.get('to') || '');
  }, [location.search]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Debounced search
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    setCurrentPage(1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadEvents({ q: value });
    }, DEBOUNCE_MS);
  };

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    setCurrentPage(1);
    loadEvents({ category: categoryId });
  };

  const handleSortChange = (sortId) => {
    setSortBy(sortId);
    setSortDropdownOpen(false);
    loadEvents({ sort: sortId });
  };

  const handleDateChange = (field, value) => {
    if (field === 'from') setDateFrom(value);
    else setDateTo(value);
    const nextFrom = field === 'from' ? value : dateFrom;
    const nextTo = field === 'to' ? value : dateTo;
    loadEvents({ from: nextFrom, to: nextTo });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setSortBy('date');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
    loadEvents({ q: '', category: 'all', sort: 'date', from: '', to: '' });
  };

  const normalizedEvents = useMemo(() => (
    events.map((event) => ({
      ...event,
      category: normalizeCategory(event.category || inferCategory(event)),
    }))
  ), [events]);

  const displayedEvents = useMemo(() => (
    normalizedEvents
      .filter((event) => isCustomerVisibleEvent(event))
      .filter((event) => showPastEvents ? isEventPast(event) : !isEventPast(event))
  ), [normalizedEvents, showPastEvents]);

  const totalPages = Math.max(Math.ceil(displayedEvents.length / PAGE_SIZE), 1);
  const safePage = Math.min(currentPage, totalPages);
  const pageEvents = displayedEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasActiveFilters = searchQuery || activeCategory !== 'all' || dateFrom || dateTo || sortBy !== 'date';

  const updatePage = useCallback((nextPage) => {
    setCurrentPage(nextPage);
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) params.set('search', searchQuery.trim()); else params.delete('search');
    if (activeCategory !== 'all') params.set('category', activeCategory); else params.delete('category');
    if (sortBy !== 'date') params.set('sort', sortBy); else params.delete('sort');
    if (dateFrom) params.set('from', dateFrom); else params.delete('from');
    if (dateTo) params.set('to', dateTo); else params.delete('to');
    params.set('page', String(nextPage));
    setSearchParams(params);
  }, [activeCategory, searchParams, searchQuery, setSearchParams, sortBy, dateFrom, dateTo]);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Date';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.16),_transparent_28%),linear-gradient(180deg,_#f8faff_0%,_#eef2ff_100%)]">
      <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-12">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-500">All Events</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Explore every live moment</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Browse the full TicketRush catalog with search, category filters, date range, and sorting.
            </p>
          </div>
          <p className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
            {normalizedEvents.length} event(s)
          </p>
        </section>

        {/* Search & Filters Panel */}
        <section className="relative z-30 mt-8 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-md shadow-slate-200/70 backdrop-blur md:p-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-violet-500" size={22} />
              <input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Tìm kiếm sự kiện, nghệ sĩ hoặc địa điểm..."
                className="h-14 w-full rounded-full border border-slate-200 bg-slate-50 pl-14 pr-5 text-base font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); loadEvents({ q: '' }); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Category + Sort + Filter Toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                {CATEGORY_FILTERS.map((categoryItem) => {
                  const isActiveCategory = activeCategory === categoryItem.id;
                  return (
                    <button
                      key={categoryItem.id}
                      type="button"
                      onClick={() => handleCategoryChange(categoryItem.id)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                        isActiveCategory
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'
                      }`}
                    >
                      {categoryItem.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSortDropdownOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700"
                  >
                    {currentSortLabel}
                    <ChevronDown size={14} />
                  </button>
                  {sortDropdownOpen && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSortChange(opt.id)}
                          className={`block w-full px-4 py-2 text-left text-sm font-medium transition ${
                            sortBy === opt.id
                              ? 'bg-violet-50 text-violet-700 font-bold'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Show Past Events Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPastEvents((v) => !v);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                    showPastEvents
                      ? 'border-violet-300 bg-violet-50 text-violet-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'
                  }`}
                >
                  <CalendarDays size={14} className={showPastEvents ? 'text-violet-600' : 'text-slate-400'} />
                  <span>Past Events</span>
                </button>

                {/* Advanced Filters Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                    showFilters || dateFrom || dateTo
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  <span className="hidden sm:inline">Filters</span>
                </button>

                {/* Clear All */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Date Range Filters */}
            {showFilters && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateChange('from', e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateChange('to', e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo(''); loadEvents({ from: '', to: '' }); }}
                    className="h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="mt-8 flex justify-center rounded-[28px] border border-slate-200 bg-white/80 p-10 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
              <p className="text-sm font-medium text-slate-500">Searching events...</p>
            </div>
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

            <div className="mt-8 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageEvents.length ? (
                pageEvents.map((event) => <EventCard key={event.id} event={event} />)
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center text-slate-500">
                  No events matched your search. Try a different keyword or category.
                </div>
              )}
            </div>

            {displayedEvents.length > PAGE_SIZE && (
              <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:flex-row">
                <p className="text-sm font-semibold text-slate-500">
                  Page {safePage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => updatePage(safePage - 1)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => updatePage(safePage + 1)}
                    className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
