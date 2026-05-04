export default function BookingSummary({ selectedSeats, onRemove, onCheckout }) {
  const total = selectedSeats.reduce((sum, item) => sum + (item.tier?.price || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 bg-white">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          🎟️ Selected Seats
          <span className="bg-violet-100 text-violet-700 text-sm py-0.5 px-2 rounded-full font-bold ml-auto">
            {selectedSeats.length}
          </span>
        </h3>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {selectedSeats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center gap-3">
            <span className="text-4xl">💺</span>
            <p className="text-sm font-medium">No seats selected yet.<br/>Click on the map to choose your seats.</p>
          </div>
        ) : (
          selectedSeats.map(item => (
            <div key={item.seat.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4 group">
              <div className="w-12 h-12 bg-violet-50 rounded-xl flex flex-col items-center justify-center text-violet-700 shrink-0 border border-violet-100">
                <span className="text-xs font-bold leading-tight">{item.seat.rowName}</span>
                <span className="text-lg font-black leading-tight">{item.seat.seatNumber}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{item.zone.name}</p>
                <p className="text-xs text-gray-500 truncate">{item.tier?.tierName || 'Standard'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">${item.tier?.price || 0}</p>
                <button 
                  onClick={() => onRemove(item.seat.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-semibold mt-1"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 font-medium">Total Price</span>
          <span className="text-2xl font-black text-gray-900">${total}</span>
        </div>
        <button 
          disabled={selectedSeats.length === 0}
          onClick={onCheckout}
          className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-lg font-bold rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] disabled:shadow-none"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
