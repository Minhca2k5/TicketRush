import { useState, useEffect } from 'react';
import api from '../../services/api';
import SeatGrid from './SeatGrid';
import SeatLegend from './SeatLegend';
import BookingSummary from './BookingSummary';

export default function SeatMapLayout({ eventId }) {
  const [seatMap, setSeatMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]); // Array of { seat, zone, tier }

  useEffect(() => {
    api.get(`/events/${eventId}/seat-map`)
      .then(res => setSeatMap(res.data?.data || res.data))
      .catch(err => console.error("Failed to load seat map", err))
      .finally(() => setLoading(false));
  }, [eventId]);

  const toggleSeat = (seat, zone, tier) => {
    if (seat.status === 'SOLD' || seat.status === 'LOCKED') return;

    setSelectedSeats(prev => {
      const isSelected = prev.some(s => s.seat.id === seat.id);
      if (isSelected) {
        return prev.filter(s => s.seat.id !== seat.id);
      } else {
        return [...prev, { seat, zone, tier }];
      }
    });
  };

  const handleCheckout = () => {
    alert("Proceed to Checkout! (Integration with Ticket Service pending)");
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-violet-600">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        <p className="font-medium mt-3">Loading seat matrix...</p>
      </div>
    );
  }

  if (!seatMap || !seatMap.zones || seatMap.zones.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-center">
        <div className="max-w-sm">
          <p className="text-5xl mb-4">🪑</p>
          <h3 className="font-bold text-gray-800 text-lg mb-1">No Seat Map Configured</h3>
          <p className="text-gray-500 text-sm mb-3">
            {seatMap?.venue?.name
              ? <>Venue <strong className="text-gray-700">"{seatMap.venue.name}"</strong> has no seating zones set up yet.</>
              : 'This event has no venue or seating zones configured.'
            }
          </p>
          <p className="text-xs text-gray-400">An admin needs to add zones and seats to this venue before tickets can be selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full">
      
      {/* Left: Seat Map Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white/50 border-r border-gray-200">
        
        {/* Stage */}
        <div className="pt-8 pb-4 px-4 flex justify-center sticky top-0 bg-white/80 backdrop-blur-sm z-10">
          <div className="w-full max-w-2xl">
            <div className="h-16 bg-gradient-to-b from-gray-800 to-gray-600 rounded-t-full shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] flex items-center justify-center border-b-4 border-violet-500">
              <span className="text-gray-300 font-bold tracking-[0.3em] uppercase text-sm">Stage</span>
            </div>
          </div>
        </div>

        {/* Seat Matrix */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-10">
          {seatMap.zones.map(zoneData => (
            <SeatGrid 
              key={zoneData.zone.id} 
              zoneData={zoneData} 
              selectedSeats={selectedSeats}
              onToggleSeat={toggleSeat}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
          <SeatLegend />
        </div>
      </div>

      {/* Right: Booking Summary Sidebar */}
      <div className="lg:w-96 shrink-0 bg-gray-50 flex flex-col h-[calc(100vh-64px-53px)] sticky top-[117px]">
        <BookingSummary 
          selectedSeats={selectedSeats} 
          onRemove={(seatId) => setSelectedSeats(prev => prev.filter(s => s.seat.id !== seatId))}
          onCheckout={handleCheckout}
        />
      </div>

    </div>
  );
}
