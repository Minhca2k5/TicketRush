import { useState, useEffect } from 'react';
import api from '../../services/api';
import SeatGrid from './SeatGrid';
import SeatLegend from './SeatLegend';
import BookingSummary from './BookingSummary';
import SeatMapRenderer from './SeatMapRenderer';

export default function SeatMapLayout({ eventId }) {
  const [seatMap, setSeatMap] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [liveSeats, setLiveSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]); // Array of { seat, zone, tier }

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        const [seatMapResponse, eventResponse] = await Promise.all([
          api.get(`/events/${eventId}/seat-layout`),
          api.get(`/events/${eventId}`),
        ]);
        if (!active) return;
        const layoutPayload = seatMapResponse.data?.data || seatMapResponse.data || null;
        setSeatMap(layoutPayload);
        setLiveSeats((layoutPayload?.zones || []).flatMap((zone) => (
          (zone.rows || []).flatMap((row) => (
            (row.seats || []).map((seat) => ({ ...seat, venueZone: { id: zone.zoneId, name: zone.zoneName } }))
          ))
        )));
        setEventDetail(eventResponse.data?.data || eventResponse.data);
      } catch (err) {
        console.error("Failed to load seat map", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitial();
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    const refreshSeats = async () => {
      try {
        const response = await api.get(`/events/${eventId}/seat-map`);
        const payload = response.data?.data || response.data || [];
        if (!Array.isArray(payload)) return;
        setLiveSeats(payload);
        const unavailableIds = new Set(payload
          .filter((seat) => ['SOLD', 'BOOKED', 'LOCKED', 'HELD', 'RESERVED'].includes(String(seat.status || '').toUpperCase()))
          .map((seat) => String(seat.id)));
        setSelectedSeats((previous) => previous.filter((item) => !unavailableIds.has(String(item.seat.id))));
      } catch (error) {
        console.error('Failed to refresh seat status', error);
      }
    };

    const interval = window.setInterval(refreshSeats, 5000);
    return () => window.clearInterval(interval);
  }, [eventId]);

  const toggleSeat = (seat, zone, tier) => {
    const status = String(seat.status || '').toUpperCase();
    if (['SOLD', 'BOOKED', 'LOCKED', 'HELD', 'RESERVED'].includes(status)) return;

    setSelectedSeats(prev => {
      const isSelected = prev.some(s => String(s.seat.id) === String(seat.id));
      if (isSelected) {
        return prev.filter(s => String(s.seat.id) !== String(seat.id));
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

  const coordinateLayout = eventDetail?.seatLayout;
  const hasCoordinateLayout = coordinateLayout?.zones?.length > 0;

  if (!hasCoordinateLayout && (!seatMap || !seatMap.zones || seatMap.zones.length === 0)) {
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
        
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {hasCoordinateLayout ? (
            <SeatMapRenderer
              isEditable={false}
              eventId={eventId}
              layout={coordinateLayout}
              liveSeats={liveSeats}
              selectedSeats={selectedSeats}
              onToggleSeat={toggleSeat}
            />
          ) : (
            <div className="flex flex-col items-center gap-10">
              {seatMap.zones.map(zoneData => (
                <SeatGrid 
                  key={zoneData.zone.id} 
                  zoneData={zoneData} 
                  selectedSeats={selectedSeats}
                  onToggleSeat={toggleSeat}
                />
              ))}
            </div>
          )}
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
