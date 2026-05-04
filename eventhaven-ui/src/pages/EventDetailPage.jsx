import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Header } from '../components/Header';
import SeatMapLayout from '../components/seat-map/SeatMapLayout';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';

const guessCategory = (ev) => {
  const t = (ev.name+' '+(ev.description||'')).toLowerCase();
  if(/music|concert|festival|jazz/.test(t)) return 'Music';
  if(/sport|marathon|championship/.test(t)) return 'Sports';
  if(/theater|comedy|broadway/.test(t)) return 'Theater';
  if(/conference|summit|tech/.test(t)) return 'Conference';
  return 'General';
};

const CAT_COLORS = {
  Music: 'bg-purple-100 text-purple-700 border-purple-200',
  Sports: 'bg-blue-100 text-blue-700 border-blue-200',
  Theater: 'bg-pink-100 text-pink-700 border-pink-200',
  Conference: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  General: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSeatMap, setShowSeatMap] = useState(false);

  useEffect(() => {
    api.get(`/events/${id}`)
      .then(res => setEvent(res.data?.data || res.data))
      .catch(err => console.error("Failed to load event", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-violet-600">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
          <p className="font-medium">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-6">
        <div className="text-6xl mb-4">🎪</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
        <p className="text-gray-500 mb-6 max-w-md">The event you are looking for does not exist or has been removed.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition shadow-lg shadow-violet-200">
          Back to Home
        </button>
      </div>
    );
  }

  const category = guessCategory(event);
  const minPrice = event.priceTiers?.length > 0 
    ? Math.min(...event.priceTiers.map(t => t.price)) 
    : 0;

  if (showSeatMap) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        {/* Small Summary Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowSeatMap(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition">
                ←
              </button>
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">{event.name}</h2>
                <p className="text-xs text-gray-500">{fmtDate(event.startTime)} • {event.venue?.name}</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Select seats to proceed</p>
            </div>
          </div>
        </div>
        
        {/* Seat Map Layout */}
        <SeatMapLayout eventId={event.id} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hero Section */}
      <div className="relative bg-gray-900 h-80 sm:h-96 w-full flex items-end">
        <div className="absolute inset-0 overflow-hidden">
          {event.bannerUrl ? (
            <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover opacity-50" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-violet-900 to-indigo-800 opacity-80" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
        </div>
        
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border mb-4 ${CAT_COLORS[category]}`}>
            {category}
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2 leading-tight">
            {event.name}
          </h1>
          <p className="text-gray-300 text-lg sm:text-xl font-medium flex items-center gap-2">
            📍 {event.venue?.name || 'Venue TBA'}
          </p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column (70%) */}
          <div className="lg:w-2/3 space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About the Event</h2>
              <div className="prose prose-violet max-w-none text-gray-600 leading-relaxed">
                {event.description ? (
                  <p className="whitespace-pre-wrap">{event.description}</p>
                ) : (
                  <p>No description provided for this event.</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Location</h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row gap-6 items-center shadow-sm">
                <div className="w-full sm:w-1/3 aspect-video bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center text-4xl shadow-inner border border-gray-200/60">
                  🗺️
                </div>
                <div className="sm:w-2/3 space-y-2 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-gray-900">{event.venue?.name || 'TBA'}</h3>
                  <p className="text-gray-600">{event.venue?.address || 'Address not available'}</p>
                  {event.venue?.totalCapacity && (
                    <p className="text-sm font-medium text-violet-600 bg-violet-50 inline-block px-3 py-1 rounded-full mt-2">
                      Capacity: {event.venue.totalCapacity.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (30%) - Sticky Card */}
          <div className="lg:w-1/3">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sticky top-24">
              <div className="space-y-6">
                
                {/* Date & Time */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-600 text-xl shrink-0">
                    📅
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Date & Time</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{fmtDate(event.startTime)}</p>
                  </div>
                </div>

                {/* Venue */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 text-xl shrink-0">
                    📍
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Venue</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{event.venue?.name || 'TBA'}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 text-xl shrink-0">
                    🎟️
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Tickets from</p>
                    <p className="text-2xl font-black text-gray-900 mt-0.5">
                      ${minPrice}
                    </p>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <button 
                  onClick={() => setShowSeatMap(true)}
                  className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-lg font-bold rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] flex items-center justify-center gap-2"
                >
                  Select Seats
                  <span className="text-xl">→</span>
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
