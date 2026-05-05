"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, RefreshCcw, ShoppingBag, X } from "lucide-react";
import { mapSeatLayoutToType, mapSeatsToType } from "@/lib/seat-types";
import { EventHeader } from "./EventHeader";
import { Stage } from "./Stage";
import { SeatMap } from "./SeatMap";
import { Legend } from "./Legend";
import { BookingCart } from "./BookingCart";
import { getSeatLayout, getSeatMap } from "../services/eventService";
import { lockSeat, releaseSeat, checkout } from "../services/bookingService";

const HOLD_MINUTES = 10;
const POLL_INTERVAL_MS = 5000;
const HOLDER_STORAGE_KEY = "ticketrush-seat-holder";
const CONFLICT_TOAST_MESSAGE = "Ghế này vừa có người đặt, vui lòng chọn ghế khác";

function getOrCreateHolderId() {
  const existing = window.localStorage.getItem(HOLDER_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = `holder-${crypto.randomUUID()}`;
  window.localStorage.setItem(HOLDER_STORAGE_KEY, generated);
  return generated;
}

export function SeatSelector({ eventId, event, initialSeats, initialLayout }) {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [timerStart, setTimerStart] = useState(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);
  const [seatLayout, setSeatLayout] = useState(initialLayout || null);
  const [liveSeats, setLiveSeats] = useState(() => {
    const mapped = mapSeatsToType(initialSeats || []);
    return mapped;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(Date.now());
  const [syncMessage, setSyncMessage] = useState("");
  const [seatActionInFlight, setSeatActionInFlight] = useState([]);
  const [toast, setToast] = useState(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const holderIdRef = useRef(null);
  const selectedSeatsRef = useRef([]);

  const mergeSeatDetails = useCallback((baseSeat, overrides = {}) => ({
    ...baseSeat,
    ...overrides,
    price: Number(overrides.price ?? baseSeat.price ?? 0),
    zone: overrides.zone ?? baseSeat.zone,
    row: overrides.row ?? baseSeat.row,
    number: overrides.number ?? baseSeat.number,
    seatLabel: overrides.seatLabel ?? baseSeat.seatLabel ?? `${baseSeat.row}${baseSeat.number}`,
  }), []);

  useEffect(() => {
    selectedSeatsRef.current = selectedSeats;
  }, [selectedSeats]);

  useEffect(() => {
    holderIdRef.current = getOrCreateHolderId();
  }, []);

  useEffect(() => {
    const mapped = mapSeatsToType(initialSeats || []);
    setLiveSeats(mapped);
  }, [initialSeats]);

  useEffect(() => {
    setSeatLayout(initialLayout || null);
  }, [initialLayout]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const syncSeatStatus = useCallback(async ({ silentError = false } = {}) => {
    setIsSyncing(true);
    try {
      const [seatMapPayload, layoutPayload] = await Promise.all([
        getSeatMap(eventId).catch(() => []),
        getSeatLayout(eventId).catch(() => null),
      ]);
      const mapped = mapSeatLayoutToType(layoutPayload);
      const mappedSeats = mapSeatsToType(Array.isArray(seatMapPayload) ? seatMapPayload : []);

      setSeatLayout(mapped.layout);
      setLiveSeats(mappedSeats.length ? mappedSeats : mapped.seats);
      setLastSyncAt(Date.now());
      setSyncMessage("");
    } catch {
      if (!silentError) {
        setSyncMessage("Live seat status is temporarily unavailable.");
      }
    } finally {
      setIsSyncing(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      return undefined;
    }

    let active = true;

    const guardedSync = async (options = {}) => {
      if (!active) {
        return;
      }
      await syncSeatStatus(options);
    };

    guardedSync();
    const interval = window.setInterval(() => {
      guardedSync({ silentError: true }).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [eventId, syncSeatStatus]);

  useEffect(() => {
    setSelectedSeats((previous) => {
      const retainableSeatIds = new Set(
        liveSeats
          .filter((seat) => seat.status === "AVAILABLE" || seat.lockHolder === holderIdRef.current)
          .map((seat) => seat.id)
      );
      const nextSelection = previous.filter((seat) => retainableSeatIds.has(seat.id));
      if (nextSelection.length !== previous.length) {
        setSyncMessage("One or more selected seats are no longer available and were removed.");
        setToast({ type: "warning", message: CONFLICT_TOAST_MESSAGE });
      }
      if (!nextSelection.length) {
        setTimerStart(null);
      }
      return nextSelection;
    });
  }, [liveSeats]);

  useEffect(() => {
    if (!eventId) {
      return undefined;
    }

    const releaseAllSelectedSeats = () => {
      const holderId = holderIdRef.current;
      if (!holderId || !selectedSeatsRef.current.length) {
        return;
      }

      selectedSeatsRef.current.forEach((seat) => {
        window.fetch(`http://localhost:8080/api/events/${eventId}/seats/${seat.id}/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holderId }),
          keepalive: true,
        }).catch(() => {});
      });
    };

    window.addEventListener("beforeunload", releaseAllSelectedSeats);
    return () => {
      releaseAllSelectedSeats();
      window.removeEventListener("beforeunload", releaseAllSelectedSeats);
    };
  }, [eventId]);

  const mutateSeatInFlight = useCallback((seatId, shouldAdd) => {
    setSeatActionInFlight((previous) =>
      shouldAdd ? [...new Set([...previous, seatId])] : previous.filter((id) => id !== seatId)
    );
  }, []);

  const handleSeatSelect = useCallback(async (seat) => {
    if (!eventId || !holderIdRef.current) {
      return;
    }

    const alreadySelected = selectedSeatsRef.current.some((item) => item.id === seat.id);
    mutateSeatInFlight(seat.id, true);

    try {
      if (alreadySelected) {
        await releaseSeat(eventId, seat.id, holderIdRef.current);
        setSelectedSeats((previous) => {
          const nextSelection = previous.filter((item) => item.id !== seat.id);
          if (!nextSelection.length) {
            setTimerStart(null);
          }
          return nextSelection;
        });
        setLiveSeats((previous) =>
          previous.map((item) =>
            item.id === seat.id
              ? { ...item, status: "AVAILABLE", lockHolder: null, lockExpiresAt: null }
              : item
          )
        );
        setSyncMessage("");
        return;
      }

      const lockedSeat = await lockSeat(eventId, seat.id, holderIdRef.current, HOLD_MINUTES);
      const mappedLockedSeat = mapSeatsToType([lockedSeat])[0];
      const nextSeat = mergeSeatDetails(
        seat,
        mappedLockedSeat
          ? {
            ...mappedLockedSeat,
            status: "LOCKED",
          }
          : {
            status: "LOCKED",
            lockHolder: lockedSeat.lockHolder,
            lockExpiresAt: lockedSeat.lockExpiresAt,
          }
      );

      setSelectedSeats((previous) => {
        if (previous.some((item) => item.id === seat.id)) {
          return previous;
        }
        if (!previous.length) {
          setTimerStart(Date.now());
        }
        return [
          ...previous,
          nextSeat,
        ];
      });
      setLiveSeats((previous) =>
        previous.map((item) =>
          item.id === seat.id
            ? mergeSeatDetails(item, nextSeat)
            : item
        )
      );
      setSyncMessage("");
    } catch {
      setSyncMessage(CONFLICT_TOAST_MESSAGE);
      setToast({ type: "warning", message: CONFLICT_TOAST_MESSAGE });
      try {
        await syncSeatStatus({ silentError: true });
      } catch {
        // Keep the current UI state if the refresh also fails.
      }
    } finally {
      mutateSeatInFlight(seat.id, false);
    }
  }, [eventId, mergeSeatDetails, mutateSeatInFlight, syncSeatStatus]);

  const handleRemoveSeat = useCallback(async (seat) => {
    await handleSeatSelect(seat);
  }, [handleSeatSelect]);

  const handleCheckout = useCallback(async () => {
    if (!eventId || !holderIdRef.current || !selectedSeats.length) return;
    setIsCheckoutLoading(true);
    try {
      const seatIds = selectedSeats.map(s => s.id);
      const order = await checkout(eventId, seatIds, holderIdRef.current);
      setOrderId(order.id);
      setCheckoutSuccess(true);
      setSelectedSeats([]);
      setTimerStart(null);
      // Trigger a sync so the map turns the seats to SOLD
      await syncSeatStatus({ silentError: true });
    } catch (err) {
      setSyncMessage("Checkout failed. Your session may have expired.");
      setToast({ type: "warning", message: "Checkout failed. Your session may have expired." });
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [eventId, selectedSeats, syncSeatStatus]);

  const total = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0),
    [selectedSeats]
  );
  const seats = useMemo(() => (
    liveSeats.map((seat) => ({
      ...seat,
      pending: seatActionInFlight.includes(seat.id),
    }))
  ), [liveSeats, seatActionInFlight]);
  const syncLabel = useMemo(() => new Date(lastSyncAt).toLocaleTimeString(), [lastSyncAt]);
  const hasSeatInventory = seats.length > 0;

  return (
    <div className="bg-[linear-gradient(180deg,#f8faff_0%,#eef2ff_100%)]">
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-10">
        <EventHeader event={event} />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/80 px-5 py-4 text-sm text-slate-600 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-900">Live seat sync</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Last updated {syncLabel}
            </span>
            {seatLayout && (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                {seatLayout.availableSeats} available · {seatLayout.lockedSeats} in queue · {seatLayout.bookedSeats} booked
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {syncMessage ? (
              <span className="inline-flex items-center gap-2 text-amber-700">
                <AlertTriangle size={16} />
                {syncMessage}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2 text-slate-500">
              <RefreshCcw size={16} className={isSyncing ? "animate-spin" : ""} />
              Auto-refresh every 5s
            </span>
          </div>
        </div>

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Stage />
            <SeatMap
              seats={seats}
              seatLayout={seatLayout}
              selectedSeats={selectedSeats}
              onSeatSelect={handleSeatSelect}
            />
            <Legend />
            {!hasSeatInventory ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-5 py-6 text-sm text-slate-500">
                No seat data is available yet. Make sure the event has a generated seat map in the Event Service.
              </div>
            ) : null}
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <BookingCart
                selectedSeats={selectedSeats}
                onRemoveSeat={handleRemoveSeat}
                onBookNow={() => setShowBookingConfirm(true)}
                timerStart={timerStart}
                total={total}
              />
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed bottom-4 left-4 right-4 z-40 xl:hidden">
        <button
          type="button"
          onClick={() => setShowMobileCart(true)}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-violet-600 px-5 py-4 text-sm font-bold text-white shadow-2xl shadow-violet-600/25"
        >
          <ShoppingBag size={18} />
          {selectedSeats.length ? `Review Selection (${selectedSeats.length})` : 'Booking Summary'}
        </button>
      </div>

      {showMobileCart && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setShowMobileCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto rounded-t-[32px] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">Booking Summary</h2>
              <button
                type="button"
                onClick={() => setShowMobileCart(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <BookingCart
              selectedSeats={selectedSeats}
              onRemoveSeat={handleRemoveSeat}
              onBookNow={() => {
                setShowMobileCart(false);
                setShowBookingConfirm(true);
              }}
              timerStart={timerStart}
              total={total}
            />
          </div>
        </div>
      )}

      {showBookingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => !isCheckoutLoading && setShowBookingConfirm(false)} />
          <div className="relative w-full max-w-md rounded-[32px] bg-white p-8 text-center shadow-2xl">
            {checkoutSuccess ? (
              <>
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check size={30} />
                </div>
                <h3 className="mt-5 text-2xl font-black text-slate-950">Payment Successful!</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Your order #{orderId} has been confirmed. Your tickets are now available.
                </p>
                <button
                  type="button"
                  onClick={() => setShowBookingConfirm(false)}
                  className="mt-6 rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-500"
                >
                  View My Tickets
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                  <ShoppingBag size={30} />
                </div>
                <h3 className="mt-5 text-2xl font-black text-slate-950">Confirm Purchase</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  You are about to purchase {selectedSeats.length} ticket(s) for a total of ${total.toLocaleString()}.
                </p>
                <button
                  type="button"
                  disabled={isCheckoutLoading}
                  onClick={handleCheckout}
                  className="mt-6 w-full flex justify-center items-center rounded-full bg-violet-600 px-6 py-4 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  {isCheckoutLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Pay Now"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isCheckoutLoading}
                  onClick={() => setShowBookingConfirm(false)}
                  className="mt-3 w-full rounded-full bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-4 top-24 z-[70] max-w-sm rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Seat conflict</p>
              <p className="mt-1 text-sm text-slate-600">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
