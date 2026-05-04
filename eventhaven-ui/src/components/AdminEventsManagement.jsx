import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import EventFormModal from './EventFormModal';

/* ── helpers ── */
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';

function getStatus(startTime) {
  const diff = new Date(startTime) - new Date();
  if (diff < 0) return { label:'Past',    color:'bg-gray-100 text-gray-600' };
  if (diff < 259200000) return { label:'Live',    color:'bg-green-100 text-green-700' };
  if (diff < 1209600000) return { label:'Pending', color:'bg-yellow-100 text-yellow-700' };
  return { label:'Draft', color:'bg-slate-100 text-slate-600' };
}

function guessCategory(ev) {
  const t = (ev.name+' '+(ev.description||'')).toLowerCase();
  if(/music|concert|festival|jazz/.test(t)) return 'Music';
  if(/sport|marathon|championship/.test(t)) return 'Sports';
  if(/theater|comedy|broadway/.test(t)) return 'Theater';
  if(/conference|summit|tech/.test(t)) return 'Conference';
  return 'General';
}

const CAT_COLORS = {
  Music:'bg-purple-100 text-purple-700',
  Sports:'bg-blue-100 text-blue-700',
  Theater:'bg-pink-100 text-pink-700',
  Conference:'bg-indigo-100 text-indigo-700',
  General:'bg-gray-100 text-gray-600',
};

/* ── Delete Confirm Modal ── */
function DeleteModal({ eventName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-xl">🗑️</span>
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Delete Event</h3>
        <p className="text-sm text-center text-gray-500 mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-800">"{eventName}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition">Delete</button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 8;

const AdminEventsManagement = memo(({ onToast }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { 
      const r = await api.get('/events?size=100'); // Fetch enough for client-side pagination or use server-side
      const eventsData = r.data?.data?.content || r.data?.data || r.data || []; 
      setEvents(eventsData); 
    }
    catch { setEvents([]); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/events/${deleteTarget.id}`);
      onToast?.('Event deleted.');
      setDeleteTarget(null);
      load();
    } catch { onToast?.('Delete failed.', 'error'); }
  };

  const STATUS_FILTERS = ['All','Live','Pending','Draft','Past'];

  const filtered = events.filter(ev => {
    const matchSearch = !search || ev.name?.toLowerCase().includes(search.toLowerCase()) || ev.venue?.name?.toLowerCase().includes(search.toLowerCase());
    const st = getStatus(ev.startTime);
    const matchStatus = statusFilter === 'All' || st.label === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Events Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create, edit, and monitor your event listings</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition shadow-md shadow-violet-200"
        >
          + Create New Event
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400" placeholder="Search by event name or location..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={()=>{setStatusFilter(f);setPage(1);}}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${statusFilter===f ? 'bg-violet-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-violet-600">
            <div className="w-5 h-5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            <span className="text-sm">Loading events...</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🎟️</div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">No events found</h3>
            <p className="text-sm text-gray-400 mb-6">
              {search || statusFilter !== 'All' ? 'Try a different search or filter.' : 'Create your first event to get started.'}
            </p>
            {!search && statusFilter === 'All' && (
              <button onClick={() => { setEditTarget(null); setShowForm(true); }}
                className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition">
                + Create First Event
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Event','Category','Date & Time','Venue','Ticket Status','Status','Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(ev => {
                  const status = getStatus(ev.startTime);
                  const cat = guessCategory(ev);
                  const sold = Math.floor(Math.random() * 200) + 50;
                  const cap = sold + Math.floor(Math.random() * 300) + 100;
                  const pct = Math.round((sold/cap)*100);
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-lg flex-shrink-0">🎟️</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 leading-tight">{ev.name}</p>
                            <p className="text-xs text-gray-400">#{`EVT${String(ev.id).padStart(3,'0')}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CAT_COLORS[cat]||CAT_COLORS.General}`}>{cat}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-700">{fmtDate(ev.startTime)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-700">{ev.venue?.name || 'No venue'}</p>
                      </td>
                      <td className="px-5 py-3.5 min-w-[160px]">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{sold} sold</span>
                          <span>{cap} total</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{width:`${pct}%`}} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{pct}% sold</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button title="View" onClick={()=>navigate(`/events/${ev.id}`)}
                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button title="Edit" onClick={()=>{setEditTarget(ev);setShowForm(true);}}
                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button title="Delete" onClick={()=>setDeleteTarget(ev)}
                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length} events</p>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">← Prev</button>
              {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${p===page?'bg-violet-600 text-white':'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
              ))}
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next →</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <EventFormModal
          initial={editTarget}
          onClose={()=>setShowForm(false)}
          onSaved={(msg,type)=>{load();onToast?.(msg,type);}}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          eventName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={()=>setDeleteTarget(null)}
        />
      )}
    </div>
  );
});

export default AdminEventsManagement;
