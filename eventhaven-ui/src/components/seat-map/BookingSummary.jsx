function getZoneLabel(item) {
  return item.zone?.name || item.zone?.zoneName || item.seat?.zoneName || item.seat?.venueZone?.name || 'General';
}

export default function BookingSummary({ selectedSeats, onRemove, onCheckout }) {
  const total = selectedSeats.reduce((sum, item) => sum + (item.tier?.price || 0), 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          Selected Seats
          <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-sm font-bold text-violet-700">
            {selectedSeats.length}
          </span>
        </h3>
      </div>

      <div className="flex-1 max-h-[calc(100vh-280px)] space-y-4 overflow-y-auto p-6">
        {selectedSeats.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-400">
            <p className="text-sm font-medium">No seats selected yet.<br />Click on the map to choose your seats.</p>
          </div>
        ) : (
          selectedSeats.map((item) => (
            <div key={item.seat.id} className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">
                <span className="text-xs font-bold leading-tight">{item.seat.rowName}</span>
                <span className="text-lg font-black leading-tight">{item.seat.seatNumber}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-gray-900">{item.seat.seatNumber}</p>
                <p className="mt-1 truncate text-xs font-bold uppercase tracking-wide text-gray-500">
                  {getZoneLabel(item)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="rounded-full bg-violet-50 px-3 py-1 text-sm font-black text-violet-700 ring-1 ring-violet-100">${item.tier?.price || 0}</p>
                <button
                  onClick={() => onRemove(item.seat.id)}
                  className="mt-1 text-xs font-semibold text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-6 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-medium text-gray-500">Total Price</span>
          <span className="text-2xl font-black text-gray-900">${total}</span>
        </div>
        <button
          disabled={selectedSeats.length === 0}
          onClick={onCheckout}
          className="w-full rounded-2xl bg-[#7C3AED] py-4 text-lg font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
