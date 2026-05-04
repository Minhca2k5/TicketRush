import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileBarChart2,
  LifeBuoy,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EventFormModal from './EventFormModal';
import { UserMenu } from './UserMenu';

const PAGE_SIZE = 6;

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users },
  { label: 'System Reports', icon: FileBarChart2 },
  { label: 'Admin Settings', icon: Settings },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy },
  { label: 'System Status', icon: ShieldCheck },
];

const statusFilters = ['All', 'Live', 'Draft', 'Past', 'Pending'];

const fallbackEvents = [
  { id: 1, name: 'Summer Music Festival 2024', description: 'Outdoor live concert with premium seating.', location: 'Central Park, NYC', startTime: '2026-07-15T19:30:00', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80', organizer: 'Aurora Entertainment' },
  { id: 2, name: 'Championship Night Finals', description: 'The biggest sports showdown of the season.', location: 'National Arena, LA', startTime: '2026-08-22T18:00:00', imageUrl: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=900&q=80', organizer: 'Prime Sports Co' },
  { id: 3, name: 'Comedy Night Special', description: 'Stand-up showcase with limited VIP lounge access.', location: 'Downtown Comedy Club', startTime: '2026-06-20T20:00:00', imageUrl: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80', organizer: 'Laugh Productions' },
  { id: 4, name: 'Corporate Gala 2024', description: 'Private premium event setup with custom seating tiers.', location: 'Grand Ballroom Hotel', startTime: '2026-09-10T17:00:00', imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80', organizer: 'Elite Events Co' },
  { id: 5, name: 'Midnight Orchestra', description: 'Classical crossover concert in a modern hall.', location: 'Opera House District', startTime: '2026-06-11T19:00:00', imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80', organizer: 'Silver Note' },
  { id: 6, name: 'Tech Future Summit', description: 'Conference with multiple sessions and reserved zones.', location: 'Innovation Center, SF', startTime: '2026-10-02T09:00:00', imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80', organizer: 'Next Horizon' },
];

function formatDateTime(value) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function inferCategory(event) {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  if (/concert|music|festival|orchestra/.test(text)) return 'Concert';
  if (/sport|final|arena|championship/.test(text)) return 'Sport';
  if (/comedy|theater|opera|gala/.test(text)) return 'Theater';
  return 'General';
}

function inferStatus(startTime) {
  if (!startTime) return 'Draft';
  const diff = new Date(startTime).getTime() - Date.now();
  if (diff < -(1000 * 60 * 60 * 8)) return 'Past';
  if (diff < 0) return 'Live';
  if (diff < 1000 * 60 * 60 * 24 * 14) return 'Pending';
  return 'Draft';
}

function inferProgress(event, index) {
  const total = 300 + index * 120;
  const sold = Math.min(total, Math.round(total * (0.35 + ((index % 4) * 0.14))));
  return { sold, total, percent: Math.max(6, Math.min(100, Math.round((sold / total) * 100))) };
}

function statusBadgeClass(status) {
  if (status === 'Live') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Pending') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'Past') return 'bg-slate-100 text-slate-500 ring-slate-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function DeleteConfirmModal({ event, onCancel, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
          <Trash2 size={24} />
        </div>
        <h3 className="mt-5 text-center text-xl font-black text-slate-950">Delete Event</h3>
        <p className="mt-3 text-center text-sm leading-6 text-slate-500">
          Are you sure you want to delete <span className="font-semibold text-slate-700">{event?.name}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminEvents() {
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/events');
      const raw = response.data?.data?.content || response.data?.data || response.data || [];
      setEvents(Array.isArray(raw) && raw.length ? raw : fallbackEvents);
    } catch {
      setEvents(fallbackEvents);
      setToast({ type: 'warning', message: 'Using fallback event data. API connection can be attached later.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const normalizedEvents = useMemo(() => {
    return events.map((event, index) => {
      const progress = inferProgress(event, index);
      const normalizedStatus = String(event.status || inferStatus(event.startTime)).trim().toUpperCase();
      return {
        ...event,
        category: event.category || inferCategory(event),
        status: normalizedStatus === 'LIVE'
          ? 'Live'
          : normalizedStatus === 'PENDING'
            ? 'Pending'
            : normalizedStatus === 'PAST'
              ? 'Past'
              : 'Draft',
        organizer: event.organizer || 'TicketRush Organizer',
        venueLabel: event.venue?.name || event.location || 'Venue TBD',
        progress,
      };
    });
  }, [events]);

  const filteredEvents = useMemo(() => {
    return normalizedEvents.filter((event) => {
      const matchesQuery = !query || `${event.name} ${event.organizer} ${event.venueLabel} ${event.category}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'All' || event.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [normalizedEvents, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const currentPageEvents = filteredEvents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/events/${deleteTarget.id}`);
      setToast({ type: 'success', message: 'Event deleted successfully.' });
      setDeleteTarget(null);
      await loadEvents();
    } catch (error) {
      setToast({
        type: 'warning',
        message: error.response?.data?.message || 'Unable to delete this event right now.',
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEdit = async (eventId) => {
    setLoadingEditor(true);
    try {
      const response = await api.get(`/events/${eventId}`);
      const payload = response.data?.data || response.data;
      setEditingEvent(payload);
      setShowForm(true);
    } catch (error) {
      setToast({
        type: 'warning',
        message: error.response?.data?.message || 'Unable to load the selected event for editing.',
      });
    } finally {
      setLoadingEditor(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-r border-[#dde6f0] bg-white">
          <div className="flex items-center gap-4 border-b border-[#e8edf4] px-8 py-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Ticket size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-950">TicketRush</p>
              <p className="text-sm text-slate-500">Admin Portal</p>
            </div>
          </div>

          <div className="px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Main</p>
            <div className="mt-4 space-y-2">
              {sidebarMain.map(({ label, icon: Icon, to }) => {
                const isActive = to ? location.pathname.startsWith(to) : false;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => to && navigate(to)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive ? 'bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-[#e8edf4] px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Support</p>
            <div className="mt-4 space-y-2">
              {sidebarSupport.map(({ label, icon: Icon }) => (
                <button key={label} type="button" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="hidden">
            <div className="hidden">
              <Search size={18} />
              <span className="text-sm">Search events...</span>
              <span className="ml-auto text-xs font-semibold">⌘K</span>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
                <ShieldCheck size={18} />
              </button>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
                <Settings size={18} />
              </button>
              <UserMenu />
            </div>
          </header>

          <main className="px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Events Management</h1>
                <p className="mt-2 text-sm text-slate-500">Create, edit, and monitor your event listings</p>
              </div>
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500"
              >
                <Plus size={16} />
                Create New Event
              </button>
            </div>

            {toast && (
              <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
                toast.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                {toast.message}
              </div>
            )}

            <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Search size={17} className="text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by title, organizer, venue, or category..."
                    className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setStatusFilter(filter);
                        setPage(1);
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        statusFilter === filter ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="px-6 py-20 text-center text-sm text-slate-500">Loading event listings...</div>
              ) : currentPageEvents.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                    <CalendarDays size={28} />
                  </div>
                  <h2 className="mt-5 text-xl font-black text-slate-950">No events found</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Adjust your search or create the first event to start managing listings.
                  </p>
                  <button
                    onClick={() => {
                      setEditingEvent(null);
                      setShowForm(true);
                    }}
                    className="mt-6 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
                  >
                    Create First Event
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1120px] w-full">
                      <thead className="bg-slate-50/90">
                        <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          <th className="px-6 py-4">Event</th>
                          <th className="px-4 py-4">Category</th>
                          <th className="px-4 py-4">Date &amp; Time</th>
                          <th className="px-4 py-4">Venue &amp; Location</th>
                          <th className="px-4 py-4">Ticket Status</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-6 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageEvents.map((event) => (
                          <tr key={event.id} className="border-t border-slate-100 text-sm text-slate-600 transition hover:bg-slate-50/70">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-4">
                                <img
                                  src={event.imageUrl || 'https://via.placeholder.com/80x80?text=Event'}
                                  alt={event.name}
                                  className="h-14 w-14 rounded-2xl object-cover shadow-sm"
                                />
                                <div>
                                  <p className="font-bold text-slate-950">{event.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">{event.organizer}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-5">
                              <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                                {event.category}
                              </span>
                            </td>
                            <td className="px-4 py-5 text-sm text-slate-700">{formatDateTime(event.startTime)}</td>
                            <td className="px-4 py-5">
                              <p className="font-medium text-slate-800">{event.venueLabel}</p>
                              <p className="mt-1 text-xs text-slate-500">{event.location || 'Location TBD'}</p>
                            </td>
                            <td className="px-4 py-5">
                              <div className="min-w-[200px]">
                                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                                  <span>{event.progress.sold} sold</span>
                                  <span>{event.progress.total} capacity</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100">
                                  <div
                                    className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                    style={{ width: `${event.progress.percent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-5">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusBadgeClass(event.status)}`}>
                                {event.status}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigate(`/admin/events/${event.id}`)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                  aria-label="View Details"
                                >
                                  <Eye size={17} />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(event.id)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                                  aria-label="Edit"
                                  disabled={loadingEditor}
                                >
                                  <Pencil size={17} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(event)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Delete"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing <span className="font-semibold text-slate-700">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                      <span className="font-semibold text-slate-700">{Math.min(page * PAGE_SIZE, filteredEvents.length)}</span> of{' '}
                      <span className="font-semibold text-slate-700">{filteredEvents.length}</span> events
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                        disabled={page === 1}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft size={16} />
                        Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                        <button
                          key={pageNumber}
                          onClick={() => setPage(pageNumber)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                            page === pageNumber ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                        disabled={page === totalPages}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </main>
        </div>
      </div>

      {showForm && (
        <EventFormModal
          initial={editingEvent}
          onClose={() => {
            setShowForm(false);
            setEditingEvent(null);
          }}
          onSaved={(message, type) => {
            setToast({ type: type === 'error' ? 'warning' : 'success', message });
            setShowForm(false);
            setEditingEvent(null);
            loadEvents();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          event={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
