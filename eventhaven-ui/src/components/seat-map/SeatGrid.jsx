import React from 'react';

export default function SeatGrid({ zoneData, selectedSeats, onToggleSeat }) {
  const { zone, priceTier, seats } = zoneData;

  // Group seats by rowName
  const rows = {};
  seats.forEach(seat => {
    if (!rows[seat.rowName]) rows[seat.rowName] = [];
    rows[seat.rowName].push(seat);
  });

  // Sort rows alphabetically (A, B, C...)
  const rowNames = Object.keys(rows).sort();

  if (!seats || seats.length === 0) {
    return (
      <div className="flex flex-col items-center bg-white p-6 rounded-3xl shadow-sm border border-dashed border-gray-200 opacity-60">
        <h3 className="text-lg font-bold text-gray-700 mb-1">{zone.name}</h3>
        <p className="text-sm text-gray-400">No seats configured for this zone yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">{zone.name}</h3>
        {priceTier && (
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm font-semibold border border-violet-100">
            <span>{priceTier.tierName}</span>
            <span className="w-1 h-1 bg-violet-300 rounded-full"></span>
            <span>${priceTier.price}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {rowNames.map(row => (
          <div key={row} className="flex items-center justify-center gap-4">
            <div className="w-6 text-center text-sm font-bold text-gray-400 select-none">
              {row}
            </div>
            
            <div className="flex gap-2">
              {/* Sort seats by seatNumber naturally */}
              {rows[row].sort((a,b) => parseInt(a.seatNumber) - parseInt(b.seatNumber)).map(seat => {
                const isSelected = selectedSeats.some(s => s.seat.id === seat.id);
                const isAvailable = seat.status === 'AVAILABLE' || !seat.status;
                const isLocked = seat.status === 'LOCKED';
                const isSold = seat.status === 'SOLD';

                let baseCls = "w-8 h-8 rounded-t-lg rounded-b-sm flex items-center justify-center text-[10px] font-semibold transition-all cursor-pointer shadow-sm ";
                
                if (isSelected) {
                  baseCls += "bg-[#7C3AED] text-white shadow-[0_4px_10px_-2px_rgba(124,58,237,0.5)] transform -translate-y-1";
                } else if (isSold) {
                  baseCls += "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300";
                } else if (isLocked) {
                  baseCls += "bg-yellow-100 text-yellow-600 border border-yellow-200 cursor-not-allowed";
                } else if (isAvailable) {
                  baseCls += "bg-white text-gray-600 border-2 border-[#E9D5FF] hover:border-[#7C3AED] hover:bg-violet-50";
                }

                return (
                  <button
                    key={seat.id}
                    title={`${row}${seat.seatNumber} - ${zone.name}`}
                    onClick={() => onToggleSeat(seat, zone, priceTier)}
                    disabled={isSold || isLocked}
                    className={baseCls}
                  >
                    {seat.seatNumber}
                  </button>
                );
              })}
            </div>

            <div className="w-6 text-center text-sm font-bold text-gray-400 select-none">
              {row}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
