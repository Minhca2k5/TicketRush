"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, RefreshCcw, ShoppingBag, X } from "lucide-react";
import { mapSeatLayoutToType, mapSeatsToType, parseLockExpiresAt } from "@/lib/seat-types";
import { EventHeader } from "./EventHeader";
import { SeatMap } from "./SeatMap";
import { Legend } from "./Legend";
import { BookingCart } from "./BookingCart";
import { getSeatLayout, getSeatMap } from "../services/eventService";
import { lockSeat, releaseSeat, checkout, validateCoupon } from "../services/bookingService";
import { getProfile } from "../services/authService";
import { readUserSettings } from "../lib/userSettings";
import SeatMapRenderer from "./seat-map/SeatMapRenderer";
import { openSeatMapSocket } from "../services/seatRealtimeService";

const HOLD_MINUTES = 10;
const POLL_INTERVAL_IDLE_MS = 5000;
const POLL_INTERVAL_ACTIVE_MS = 3000;
const REALTIME_RECONNECT_MS = 2500;
const REALTIME_REFRESH_DEBOUNCE_MS = 150;
const HOLDER_STORAGE_KEY = "ticketrush-seat-holder";
const SELECTION_STORAGE_PREFIX = "ticketrush-seat-selection";
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

function getAccountHolderId(profile) {
  if (profile?.id) return `user-${profile.id}`;
  if (profile?.username) return `user-${profile.username}`;
  return null;
}

function normalizeCanvasSeatStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (["SOLD", "BOOKED", "UNAVAILABLE"].includes(normalized)) return "SOLD";
  if (["LOCKED", "WAITING", "HELD", "RESERVED", "IN_QUEUE"].includes(normalized)) return "LOCKED";
  return "AVAILABLE";
}

function getCanvasSeatNumber(seatNumber) {
  const value = String(seatNumber || "");
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function toBookingSeat(layoutSeat, zone, tier) {
  const seatNumber = String(layoutSeat.seatNumber || "");
  const row = layoutSeat.rowName || seatNumber.replace(/\d+$/, "") || "A";
  const zoneName = zone?.name || zone?.zoneName || "General";
  return {
    id: layoutSeat.id,
    row,
    number: getCanvasSeatNumber(seatNumber),
    seatLabel: seatNumber || `${row}${getCanvasSeatNumber(seatNumber)}`,
    zone: zoneName,
    zoneName,
    zoneTitle: zoneName,
    price: Number(tier?.price ?? zone?.price ?? layoutSeat.price ?? 0),
    status: normalizeCanvasSeatStatus(layoutSeat.status),
    lockHolder: layoutSeat.lockHolder ?? null,
    lockExpiresAt: layoutSeat.lockExpiresAt ?? null,
  };
}

function resolveZoneName(seat, fallback = "General") {
  return seat?.zoneName || seat?.zoneTitle || seat?.venueZone?.name || seat?.zone || fallback;
}

function getSelectionStorageKey(eventId, holderId) {
  return `${SELECTION_STORAGE_PREFIX}:${eventId}:${holderId}`;
}

function readStoredSelection(eventId, holderId) {
  if (!eventId || !holderId) return null;

  try {
    const stored = window.localStorage.getItem(getSelectionStorageKey(eventId, holderId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function writeStoredSelection(eventId, holderId, payload) {
  if (!eventId || !holderId) return;

  const key = getSelectionStorageKey(eventId, holderId);
  if (!payload?.selectedSeatIds?.length) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(payload));
}

function getSelectionExpirationTime(selectedSeats) {
  return selectedSeats
    .map((seat) => parseLockExpiresAt(seat.lockExpiresAt))
    .filter((value) => value > 0 && value > Date.now())
    .sort((first, second) => first - second)[0];
}

function getRestoredTimerStart(selectedSeats, storedExpirationTime) {
  const expirationTime = Number(storedExpirationTime || getSelectionExpirationTime(selectedSeats) || 0);

  return expirationTime ? expirationTime - HOLD_MINUTES * 60 * 1000 : null;
}

export function SeatSelector({ eventId, event, initialSeats, initialRawSeats, initialLayout, initialCoordinateLayout }) {
  const navigate = useNavigate();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [timerStart, setTimerStart] = useState(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [seatLayout, setSeatLayout] = useState(initialLayout || null);
  const [coordinateLayout, setCoordinateLayout] = useState(initialCoordinateLayout || null);
  const [rawLiveSeats, setRawLiveSeats] = useState(initialRawSeats || []);
  const [liveSeats, setLiveSeats] = useState(() => {
    return initialSeats || [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(Date.now());
  const [syncMessage, setSyncMessage] = useState("");
  const [seatActionInFlight, setSeatActionInFlight] = useState([]);
  const [toast, setToast] = useState(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [showHoldExpiredModal, setShowHoldExpiredModal] = useState(false);
  const [userSettings, setUserSettings] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [reminderShownFor, setReminderShownFor] = useState(null);
  const [changedSeatIds, setChangedSeatIds] = useState([]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const total = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0),
    [selectedSeats]
  );

  const handleApplyCoupon = async (code) => {
    if (!code || !code.trim()) {
      setCouponError("Vui lòng nhập mã giảm giá");
      return;
    }
    setIsApplyingCoupon(true);
    setCouponError("");
    try {
      const response = await validateCoupon(code, total);
      if (response.success && response.data?.valid) {
        setAppliedCoupon(response.data);
        setToast({ type: "info", message: "Áp dụng mã giảm giá thành công!" });
      } else {
        setCouponError(response.message || response.data?.message || "Mã giảm giá không hợp lệ");
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError("Lỗi kiểm tra mã giảm giá");
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const holderIdRef = useRef(null);
  const selectedSeatsRef = useRef([]);
  const releaseExpiredInFlightRef = useRef(false);
  const hasHydratedSelectionRef = useRef(false);
  const realtimeRefreshTimerRef = useRef(null);
  const realtimeReconnectTimerRef = useRef(null);

  const mergeSeatDetails = useCallback((baseSeat, overrides = {}) => {
    const zoneName = resolveZoneName(baseSeat, resolveZoneName(overrides));

    return {
      ...baseSeat,
      ...overrides,
      price: Number(overrides.price ?? baseSeat.price ?? 0),
      zone: zoneName,
      zoneName,
      zoneTitle: zoneName,
      lockHolder: overrides.lockHolder ?? baseSeat.lockHolder ?? null,
      lockExpiresAt: overrides.lockExpiresAt ?? baseSeat.lockExpiresAt ?? null,
      row: overrides.row ?? baseSeat.row,
      number: overrides.number ?? baseSeat.number,
      seatLabel: overrides.seatLabel ?? baseSeat.seatLabel ?? `${baseSeat.row}${baseSeat.number}`,
    };
  }, []);

  useEffect(() => {
    selectedSeatsRef.current = selectedSeats;
  }, [selectedSeats]);

  useEffect(() => {
    holderIdRef.current = getOrCreateHolderId();

    let isActive = true;
    getProfile()
      .then((profile) => {
        if (!isActive) return;
        setCustomerProfile(profile);
        setUserSettings(readUserSettings(profile));
        const accountHolderId = getAccountHolderId(profile);
        if (!accountHolderId) {
          setIsProfileLoaded(true);
          return;
        }

        holderIdRef.current = accountHolderId;
        window.localStorage.setItem(HOLDER_STORAGE_KEY, accountHolderId);
        setIsProfileLoaded(true);
      })
      .catch(() => {
        if (!isActive) return;
        // Keep the anonymous holder fallback so seat selection still works for older sessions.
        setIsProfileLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userSettings?.bookingReminders || !timerStart || !selectedSeats.length) {
      setReminderShownFor(null);
      return undefined;
    }

    const reminderMs = Number(userSettings.holdReminderMinutes || 2) * 60 * 1000;
    const expiresAt = timerStart + HOLD_MINUTES * 60 * 1000;
    const reminderAt = expiresAt - reminderMs;
    const key = `${eventId}:${expiresAt}`;

    const showReminder = () => {
      if (Date.now() >= reminderAt && Date.now() < expiresAt && reminderShownFor !== key) {
        setReminderShownFor(key);
        setToast({
          type: "warning",
          message: `Your held seats expire in about ${userSettings.holdReminderMinutes} minute(s).`,
        });
      }
    };

    showReminder();
    const reminderTimer = window.setInterval(showReminder, 10000);
    return () => window.clearInterval(reminderTimer);
  }, [eventId, reminderShownFor, selectedSeats.length, timerStart, userSettings]);

  useEffect(() => {
    const holderId = holderIdRef.current;
    if (!eventId || !holderId) return;
    if (!hasHydratedSelectionRef.current && !selectedSeats.length) return;

    writeStoredSelection(eventId, holderId, {
      selectedSeatIds: selectedSeats.map((seat) => seat.id),
      expirationTime: getSelectionExpirationTime(selectedSeats),
      selectedSeats,
      couponCode: appliedCoupon ? couponCode : "",
    });
  }, [eventId, selectedSeats, appliedCoupon, couponCode]);

  useEffect(() => {
    setLiveSeats(initialSeats || []);
  }, [initialSeats]);

  useEffect(() => {
    setRawLiveSeats(initialRawSeats || []);
  }, [initialRawSeats]);

  useEffect(() => {
    setSeatLayout(initialLayout || null);
  }, [initialLayout]);

  useEffect(() => {
    setCoordinateLayout(initialCoordinateLayout || null);
  }, [initialCoordinateLayout]);

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
      setRawLiveSeats(Array.isArray(seatMapPayload) ? seatMapPayload : []);
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

  const scheduleRealtimeSeatSync = useCallback(() => {
    if (realtimeRefreshTimerRef.current) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      syncSeatStatus({ silentError: true }).catch(() => {});
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [syncSeatStatus]);

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
    // Dynamic polling: faster when user has selected seats
    const pollMs = selectedSeatsRef.current.length > 0 ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_IDLE_MS;
    const interval = window.setInterval(() => {
      guardedSync({ silentError: true }).catch(() => {});
    }, pollMs);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [eventId, syncSeatStatus, selectedSeats.length]);

  useEffect(() => {
    if (!eventId) {
      return undefined;
    }

    let active = true;
    let socket = null;

    const connect = () => {
      if (!active) {
        return;
      }

      socket = openSeatMapSocket(eventId, {
        onOpen: () => {
          setSyncMessage("");
          scheduleRealtimeSeatSync();
        },
        onMessage: (message) => {
          if (message?.type !== "SEAT_MAP_UPDATED") {
            return;
          }
          if (String(message.eventId) !== String(eventId)) {
            return;
          }
          scheduleRealtimeSeatSync();
        },
        onClose: () => {
          if (!active) {
            return;
          }
          realtimeReconnectTimerRef.current = window.setTimeout(connect, REALTIME_RECONNECT_MS);
        },
      });
    };

    connect();

    return () => {
      active = false;
      if (realtimeReconnectTimerRef.current) {
        window.clearTimeout(realtimeReconnectTimerRef.current);
        realtimeReconnectTimerRef.current = null;
      }
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      if (socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(socket.readyState)) {
        socket.close();
      }
    };
  }, [eventId, scheduleRealtimeSeatSync]);

  useEffect(() => {
    // Detect changed seats for visual flash
    setChangedSeatIds((prev) => {
      const changed = liveSeats
        .filter((seat) => {
          const oldSeat = selectedSeatsRef.current.find((s) => s.id === seat.id);
          return oldSeat && oldSeat.status !== seat.status;
        })
        .map((s) => s.id);
      return changed;
    });
    // Clear flash after animation
    if (changedSeatIds.length) {
      const timer = setTimeout(() => setChangedSeatIds([]), 1200);
      return () => clearTimeout(timer);
    }

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
    if (appliedCoupon && selectedSeats.length > 0) {
      validateCoupon(couponCode, total)
        .then((response) => {
          if (response.success && response.data?.valid) {
            setAppliedCoupon(response.data);
          } else {
            setAppliedCoupon(null);
            setCouponError(response.message || "Mã giảm giá không còn hiệu lực cho đơn hàng này");
          }
        })
        .catch(() => {
          setAppliedCoupon(null);
        });
    } else if (selectedSeats.length === 0) {
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");
    }
  }, [total, selectedSeats.length]);

  useEffect(() => {
    const holderId = holderIdRef.current;
    if (!eventId || !holderId || !isProfileLoaded || hasHydratedSelectionRef.current || !liveSeats.length) {
      return;
    }

    const stored = readStoredSelection(eventId, holderId);
    const storedSeats = Array.isArray(stored?.selectedSeats) ? stored.selectedSeats : [];
    const storedIds = Array.isArray(stored?.selectedSeatIds) ? stored.selectedSeatIds : [];
    const storedSeatIds = new Set((storedIds.length ? storedIds : storedSeats.map((seat) => seat.id)).map((id) => String(id)));
    const storedExpirationTime = Number(stored?.expirationTime || 0);
    const hasValidStoredHold = !storedExpirationTime || storedExpirationTime > Date.now();
    const heldSeats = liveSeats.filter((seat) => {
      const seatId = String(seat.id);
      const status = String(seat.status || "").toUpperCase();
      const isStoredSeat = storedSeatIds.has(seatId);
      const expiresAt = seat.lockExpiresAt ? parseLockExpiresAt(seat.lockExpiresAt) : (storedExpirationTime || 0);
      const seatHoldStillValid = !expiresAt || expiresAt > Date.now();
      const isHeldByHolder = seat.lockHolder === holderId;
      const isRecoverableStoredLock = hasValidStoredHold && isStoredSeat && status === "LOCKED";

      return (!storedSeatIds.size || isStoredSeat)
        && seatHoldStillValid
        && (isHeldByHolder || isRecoverableStoredLock);
    });

    if (!heldSeats.length) {
      hasHydratedSelectionRef.current = true;
      writeStoredSelection(eventId, holderId, null);
      return;
    }

    const restoredSeats = heldSeats.map((seat) => {
      const storedSeat = storedSeats.find((item) => String(item.id) === String(seat.id));
      return mergeSeatDetails(storedSeat || seat, {
        ...seat,
        lockHolder: seat.lockHolder ?? holderId,
        lockExpiresAt: seat.lockExpiresAt ?? storedSeat?.lockExpiresAt ?? (storedExpirationTime ? new Date(storedExpirationTime).toISOString() : null),
      });
    });

    setSelectedSeats(restoredSeats);
    setTimerStart(getRestoredTimerStart(restoredSeats, stored?.expirationTime));
    hasHydratedSelectionRef.current = true;
  }, [eventId, liveSeats, isProfileLoaded, mergeSeatDetails]);

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
      const fallbackLockExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
      const nextSeat = mergeSeatDetails(
        seat,
        mappedLockedSeat
          ? {
            ...mappedLockedSeat,
            status: "LOCKED",
            lockHolder: mappedLockedSeat.lockHolder ?? holderIdRef.current,
            lockExpiresAt: mappedLockedSeat.lockExpiresAt ?? lockedSeat.lockExpiresAt ?? fallbackLockExpiresAt,
          }
          : {
            status: "LOCKED",
            lockHolder: lockedSeat.lockHolder,
            lockExpiresAt: lockedSeat.lockExpiresAt ?? fallbackLockExpiresAt,
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

  const handleCanvasSeatSelect = useCallback((layoutSeat, zone, tier) => {
    handleSeatSelect(toBookingSeat(layoutSeat, zone, tier));
  }, [handleSeatSelect]);

  const handleReleaseTicket = useCallback(async () => {
    const holderId = holderIdRef.current;
    const seatsToRelease = selectedSeatsRef.current;

    if (!eventId || !holderId || !seatsToRelease.length || releaseExpiredInFlightRef.current) {
      return;
    }

    releaseExpiredInFlightRef.current = true;
    const seatIds = seatsToRelease.map((seat) => seat.id);

    try {
      const releaseResults = await Promise.allSettled(
        seatIds.map((seatId) => releaseSeat(eventId, seatId, holderId))
      );
      const releasedSeatIds = seatIds.filter((_, index) => releaseResults[index].status === "fulfilled");

      if (!releasedSeatIds.length) {
        setSyncMessage("Your hold expired, but the seats could not be released. Refreshing seat status...");
        await syncSeatStatus({ silentError: true });
        return;
      }

      setSelectedSeats([]);
      setTimerStart(null);
      setShowMobileCart(false);
      setLiveSeats((previous) =>
        previous.map((seat) =>
          releasedSeatIds.includes(seat.id)
            ? { ...seat, status: "AVAILABLE", lockHolder: null, lockExpiresAt: null }
            : seat
        )
      );
      setRawLiveSeats((previous) =>
        previous.map((seat) =>
          releasedSeatIds.includes(seat.id)
            ? { ...seat, status: "AVAILABLE", lockHolder: null, lockExpiresAt: null }
            : seat
        )
      );
      setSyncMessage("Your hold expired. The selected seats were released.");
      setShowHoldExpiredModal(true);
      await syncSeatStatus({ silentError: true });
    } finally {
      releaseExpiredInFlightRef.current = false;
    }
  }, [eventId, syncSeatStatus]);



  const selectionExpiresAt = useMemo(() => {
    const expirationTime = getSelectionExpirationTime(selectedSeats);
    return expirationTime ? new Date(expirationTime).toISOString() : null;
  }, [selectedSeats]);
  const seats = useMemo(() => (
    liveSeats.map((seat) => ({
      ...seat,
      heldByCurrentUser: selectedSeats.some((selectedSeat) => String(selectedSeat.id) === String(seat.id))
        || (seat.status === "LOCKED" && seat.lockHolder === holderIdRef.current),
      pending: seatActionInFlight.includes(seat.id),
      justChanged: changedSeatIds.includes(seat.id),
    }))
  ), [liveSeats, seatActionInFlight, selectedSeats, changedSeatIds]);
  const syncLabel = useMemo(() => new Date(lastSyncAt).toLocaleTimeString(), [lastSyncAt]);
  const hasSeatInventory = seats.length > 0;
  const hasCoordinateLayout = Array.isArray(coordinateLayout?.zones) && coordinateLayout.zones.length > 0;

  return (
    <div className="bg-[linear-gradient(180deg,#f6f8fc_0%,#eef3f8_48%,#f8fafc_100%)]">
      <main className="mx-auto max-w-[1760px] px-4 py-8 lg:px-8 lg:py-10">
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
              Realtime WebSocket + polling fallback
            </span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-9">
            {hasCoordinateLayout ? (
              <div className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-sm md:p-5">
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-900">Interactive Seat Map</h3>
                  <p className="text-sm text-slate-500">
                    The venue layout is rendered from the admin design canvas, including stage, field, exits, zones, and rotation.
                  </p>
                </div>
                <div className="h-[calc(100vh-220px)] min-h-[620px]">
                  <SeatMapRenderer
                    isEditable={false}
                    eventId={eventId}
                    layout={coordinateLayout}
                    liveSeats={rawLiveSeats}
                    selectedSeats={selectedSeats.map((seat) => ({ seat }))}
                    canvasTheme="light"
                    fillViewport
                    onToggleSeat={handleCanvasSeatSelect}
                  />
                </div>
              </div>
            ) : (
              <SeatMap
                seats={seats}
                seatLayout={seatLayout}
                selectedSeats={selectedSeats}
                onSeatSelect={handleSeatSelect}
              />
            )}
            <Legend />
            {!hasSeatInventory ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-5 py-6 text-sm text-slate-500">
                No seat data is available yet. Make sure the event has a generated seat map in the Event Service.
              </div>
            ) : null}
          </div>

          <aside className="hidden xl:col-span-3 xl:block">
            <div className="sticky top-24">
              <BookingCart
                selectedSeats={selectedSeats}
                onRemoveSeat={handleRemoveSeat}
                onBookNow={() => navigate(`/events/${eventId}/checkout`)}
                onTimerExpired={handleReleaseTicket}
                timerStart={timerStart}
                expiresAt={selectionExpiresAt}
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
                navigate(`/events/${eventId}/checkout`);
              }}
              onTimerExpired={handleReleaseTicket}
              timerStart={timerStart}
              expiresAt={selectionExpiresAt}
              total={total}
            />
          </div>
        </div>
      )}



      {showHoldExpiredModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-[32px] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle size={30} />
            </div>
            <h3 className="mt-5 text-2xl font-black text-slate-950">Seat Hold Expired</h3>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Thời gian giữ chỗ của bạn đã hết. Ghế đã được giải phóng để người khác có thể đặt.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowHoldExpiredModal(false);
                syncSeatStatus({ silentError: true });
              }}
              className="mt-6 w-full rounded-full bg-violet-600 px-6 py-4 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              Back to Seat Selection
            </button>
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
