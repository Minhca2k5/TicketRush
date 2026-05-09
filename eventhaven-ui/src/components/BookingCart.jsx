import { useEffect, useMemo, useState } from 'react';
import { Clock3, Ticket, Trash2 } from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function getSeatLabel(seat) {
  return seat.seatLabel || seat.label || `${seat.row || ''}${seat.number || ''}` || 'Seat';
}

function getZoneLabel(seat) {
  return seat.zoneName || seat.zoneTitle || seat.zone || seat.venueZone?.name || 'General';
}

export function BookingCart({ selectedSeats, onRemoveSeat, onBookNow, onTimerExpired, timerStart, expiresAt, total }) {
  const [remaining, setRemaining] = useState(600);

  useEffect(() => {
    if (!selectedSeats.length) {
      setRemaining(600);
      return undefined;
    }

    const tick = () => {
      if (expiresAt) {
        const expiresAtMs = new Date(expiresAt).getTime();
        if (!Number.isNaN(expiresAtMs)) {
          setRemaining(Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)));
          return;
        }
      }

      if (selectedSeats.length) {
        const seatExpiresAt = selectedSeats
          .map((seat) => new Date(seat.lockExpiresAt || 0).getTime())
          .filter((value) => !Number.isNaN(value) && value > Date.now())
          .sort((first, second) => first - second)[0];

        if (seatExpiresAt) {
          setRemaining(Math.max(0, Math.ceil((seatExpiresAt - Date.now()) / 1000)));
          return;
        }
      }

      if (timerStart) {
        const elapsed = Math.floor((Date.now() - timerStart) / 1000);
        setRemaining(Math.max(0, 600 - elapsed));
        return;
      }

      setRemaining(600);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, timerStart, selectedSeats]);

  useEffect(() => {
    if ((expiresAt || timerStart) && selectedSeats.length && remaining === 0) {
      onTimerExpired?.();
    }
  }, [expiresAt, onTimerExpired, remaining, selectedSeats.length, timerStart]);

  const formatted = useMemo(() => {
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [remaining]);

  const subtotalLabel = useMemo(() => currencyFormatter.format(total || 0), [total]);

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_50px_rgba(148,163,184,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-950">Booking Summary</h3>
          <p className="mt-1 text-sm text-slate-500">Review selected seats before checkout.</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-right">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            <Clock3 size={14} />
            10-minute checkout
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{formatted}</p>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
        {selectedSeats.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Pick one or more seats to unlock checkout.
          </div>
        ) : (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {selectedSeats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900">{getSeatLabel(seat)}</p>
                  <p className="mt-1 truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                    {getZoneLabel(seat)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="rounded-full bg-violet-50 px-3 py-1 text-sm font-black text-violet-700 ring-1 ring-violet-100">
                    {currencyFormatter.format(seat.price || 0)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemoveSeat(seat)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-[24px] bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span className="inline-flex items-center gap-2"><Ticket size={16} />Selected Seats</span>
          <span>{selectedSeats.length}</span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-sm text-slate-400">Subtotal</span>
          <span className="text-3xl font-black">{subtotalLabel}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!selectedSeats.length}
        onClick={onBookNow}
        className="mt-5 w-full rounded-full bg-violet-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
