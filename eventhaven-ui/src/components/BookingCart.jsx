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

export function BookingCart({
  isPending = false,
  selectedSeats,
  onRemoveSeat,
  onBookNow,
  onTimerExpired,
  timerStart,
  expiresAt,
  total,
  couponCode,
  setCouponCode,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  couponError,
  isApplyingCoupon
}) {
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
  const checkoutDisabled = isPending || !selectedSeats.length;

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_50px_rgba(148,163,184,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-950">Booking Summary</h3>
          <p className="mt-1 text-sm text-slate-500">
            {isPending ? "Vé chưa mở bán chính thức. Vui lòng quay lại sau." : "Review selected seats before checkout."}
          </p>
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
            {isPending ? "Đây là chế độ xem trước. Việc chọn ghế sẽ mở khi sự kiện chuyển sang Live." : "Pick one or more seats to unlock checkout."}
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

      {selectedSeats.length > 0 && (
        <div className="mt-4 border-t border-slate-200/80 pt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mã giảm giá</label>
          {appliedCoupon ? (
            <div className="mt-1.5 flex items-center justify-between rounded-2xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase tracking-wider bg-green-200 text-green-800 px-2 py-0.5 rounded text-xs animate-pulse">
                  {couponCode.toUpperCase()}
                </span>
                <span className="text-xs font-bold">Áp dụng thành công</span>
              </div>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
              >
                Gỡ bỏ
              </button>
            </div>
          ) : (
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                placeholder="Nhập mã (ví dụ: SUMMER20)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="button"
                disabled={isApplyingCoupon || !couponCode.trim()}
                onClick={() => onApplyCoupon(couponCode)}
                className="shrink-0 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isApplyingCoupon ? "Đang áp dụng..." : "Áp dụng"}
              </button>
            </div>
          )}
          {couponError && (
            <p className="mt-1.5 text-xs font-semibold text-red-500">{couponError}</p>
          )}
        </div>
      )}

      <div className="mt-5 rounded-[24px] bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span className="inline-flex items-center gap-2"><Ticket size={16} />Selected Seats</span>
          <span>{selectedSeats.length}</span>
        </div>
        
        {appliedCoupon ? (
          <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Subtotal</span>
              <span>{currencyFormatter.format(total || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-green-400 font-semibold">
              <span>Giảm giá ({couponCode.toUpperCase()})</span>
              <span>-{currencyFormatter.format(appliedCoupon.discountAmount || 0)}</span>
            </div>
            <div className="flex items-end justify-between border-t border-slate-800 pt-2">
              <span className="text-sm text-slate-300">Total Price</span>
              <span className="text-3xl font-black text-green-400">{currencyFormatter.format(appliedCoupon.finalPrice || 0)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-end justify-between border-t border-slate-800 pt-3">
            <span className="text-sm text-slate-400">Subtotal</span>
            <span className="text-3xl font-black">{subtotalLabel}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={checkoutDisabled}
        onClick={onBookNow}
        className="mt-5 w-full rounded-full bg-violet-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending ? "Chưa mở bán" : "Proceed to Checkout"}
      </button>
    </div>
  );
}
