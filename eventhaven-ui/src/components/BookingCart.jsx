export function BookingCart({ selectedSeats, onRemoveSeat, onBookNow, timerStart, total }) {
  return (
    <div className="cart bg-background border border-border rounded-xl p-4 shadow-sm">
      <h3 className="cart-title font-semibold text-foreground">
        Your Cart ({selectedSeats.length} seats)
      </h3>
      {selectedSeats.length === 0 ? (
        <p className="text-muted-foreground text-sm">No seats selected</p>
      ) : (
        <>
          <div className="cart-items space-y-2 max-h-60 overflow-y-auto mt-3">
            {selectedSeats.map((seat) => (
              <div key={seat.id} className="cart-item flex justify-between items-center">
                <span className="text-sm">
                  {seat.row}{seat.number} ({seat.zone})
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">${seat.price.toLocaleString()}</span>
                  <button
                    onClick={() => onRemoveSeat(seat)}
                    className="text-red-500 hover:text-red-700 text-lg"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-total flex justify-between font-bold mt-4 pt-3 border-t border-border">
            <span>Total:</span>
            <span>${total.toLocaleString()} VND</span>
          </div>
          <button
            onClick={onBookNow}
            className="book-btn w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg font-medium mt-4"
          >
            Book Now
          </button>
        </>
      )}
    </div>
  );
}
