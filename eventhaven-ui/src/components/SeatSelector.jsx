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
import { getAccountHolderId, getOrCreateHolderId, HOLDER_STORAGE_KEY, setStoredHolderId } from "../lib/holder";
import { readStoredSelection, writeStoredSelection } from "../lib/selection-storage";

const HOLD_MINUTES = 10;
const POLL_INTERVAL_IDLE_MS = 5000;
const POLL_INTERVAL_ACTIVE_MS = 3000;
const REALTIME_RECONNECT_MS = 2500;
const REALTIME_REFRESH_DEBOUNCE_MS = 150;
const PENDING_PREVIEW_TOAST_MESSAGE = "Sự kiện đang ở trạng thái chờ mở bán. Bạn hiện chỉ có thể xem trước sơ đồ ghế!";
const CONFLICT_TOAST_MESSAGE = "Ghế này vừa có người đặt, vui lòng chọn ghế khác";

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

export function SeatSelector({ eventId, event, isPending = false, initialSeats, initialRawSeats, initialLayout, initialCoordinateLayout }) {
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
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);

  const total = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0),
    [selectedSeats]
  );
  const previewNotice = "Vé chưa mở bán chính thức. Vui lòng quay lại sau.";

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
        setToast({ type: "info", title: "Coupon applied", message: "Áp dụng mã giảm giá thành công!" });
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
        setStoredHolderId(accountHolderId);
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
          title: "Seat hold reminder",
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

  useEffect(() => {
    if (!isPending) {
      return;
    }

    setSelectedSeats([]);
    setTimerStart(null);
    setShowBookingConfirm(false);
  }, [isPending]);

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
    const changed = liveSeats
      .filter((seat) => {
        const oldSeat = selectedSeatsRef.current.find((s) => s.id === seat.id);
        return oldSeat && oldSeat.status !== seat.status;
      })
      .map((s) => s.id);

    setChangedSeatIds(changed);

    // Clear flash after animation
    let flashTimer;
    if (changed.length) {
      flashTimer = setTimeout(() => setChangedSeatIds([]), 1200);
    }

    // Always prune seats that are no longer available
    setSelectedSeats((previous) => {
      const retainableSeatIds = new Set(
        liveSeats
          .filter((seat) => seat.status === "AVAILABLE" || seat.lockHolder === holderIdRef.current)
          .map((seat) => seat.id)
      );
      const nextSelection = previous.filter((seat) => retainableSeatIds.has(seat.id));
      if (nextSelection.length !== previous.length) {
        setSyncMessage("One or more selected seats are no longer available and were removed.");
        setToast({ type: "warning", title: "Seat conflict", message: CONFLICT_TOAST_MESSAGE });
      }
      if (!nextSelection.length) {
        setTimerStart(null);
      }
      return nextSelection;
    });

    return () => {
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [liveSeats]);

  useEffect(() => {
    if (selectedSeats.length === 0) {
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");
      return undefined;
    }

    if (!appliedCoupon) return undefined;

    let ignore = false;
    const timer = window.setTimeout(() => {
      validateCoupon(couponCode, total)
        .then((response) => {
          if (ignore) return;
          if (response.success && response.data?.valid) {
            setAppliedCoupon(response.data);
          } else {
            setAppliedCoupon(null);
            setCouponError(response.message || "Mã giảm giá không còn hiệu lực cho đơn hàng này");
          }
        })
        .catch(() => {
          if (!ignore) setAppliedCoupon(null);
        });
    }, 500);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
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
    if (isPending) {
      setToast({
        type: "info",
        title: "Preview mode",
        message: PENDING_PREVIEW_TOAST_MESSAGE,
      });
      return;
    }

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
      setToast({ type: "warning", title: "Seat conflict", message: CONFLICT_TOAST_MESSAGE });
      try {
        await syncSeatStatus({ silentError: true });
      } catch {
        // Keep the current UI state if the refresh also fails.
      }
    } finally {
      mutateSeatInFlight(seat.id, false);
    }
  }, [eventId, isPending, mergeSeatDetails, mutateSeatInFlight, syncSeatStatus]);

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

  const handleCheckout = useCallback(async () => {
    if (isPending) {
      setToast({
        type: "info",
        title: "Preview mode",
        message: PENDING_PREVIEW_TOAST_MESSAGE,
      });
      return;
    }
    if (!eventId || !holderIdRef.current || !selectedSeats.length) return;
    setIsCheckoutLoading(true);
    try {
      const seatIds = selectedSeats.map(s => s.id);
      const codeToApply = appliedCoupon ? couponCode : '';
      const order = await checkout(eventId, seatIds, holderIdRef.current, {
        email: customerProfile?.email,
        name: customerProfile?.username,
      }, codeToApply);
      setOrderId(order.id);
      setCheckoutSuccess(true);
      setSelectedSeats([]);
      setTimerStart(null);
      setAppliedCoupon(null);
      setCouponCode("");
      // Trigger a sync so the map turns the seats to SOLD
      await syncSeatStatus({ silentError: true });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Checkout failed. Your session may have expired.";
      setSyncMessage(errMsg);
      setToast({ type: "warning", title: "Checkout failed", message: errMsg });
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [customerProfile, eventId, selectedSeats, syncSeatStatus, appliedCoupon, couponCode, isPending]);

  const handleOpenCheckout = useCallback(() => {
    if (isPending) {
      setToast({
        type: "info",
        title: "Preview mode",
        message: PENDING_PREVIEW_TOAST_MESSAGE,
      });
      return;
    }

    setShowBookingConfirm(true);
  }, [isPending]);

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
                    readOnly={isPending}
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
                readOnly={isPending}
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
                isPending={isPending}
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
          {selectedSeats.length
            ? `Review Selection (${selectedSeats.length})`
            : isPending
              ? 'Preview Summary'
              : 'Booking Summary'}
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
              isPending={isPending}
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
                  onClick={() => {
                    setShowBookingConfirm(false);
                    navigate("/orders");
                  }}
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
                {appliedCoupon ? (
                  <div className="mt-3 text-sm text-slate-500 space-y-1.5 border border-slate-100 bg-slate-50 p-4 rounded-2xl">
                    <p>You are about to purchase {selectedSeats.length} ticket(s).</p>
                    <div className="flex justify-between items-center text-xs">
                      <span>Subtotal:</span>
                      <span className="line-through">${total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-green-600 font-semibold">
                      <span>Discount ({couponCode.toUpperCase()}):</span>
                      <span>-${appliedCoupon.discountAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-base font-black text-slate-950 border-t border-slate-200 pt-1.5">
                      <span>Total:</span>
                      <span>${appliedCoupon.finalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    You are about to purchase {selectedSeats.length} ticket(s) for a total of ${total.toLocaleString()}.
                  </p>
                )}
                <button
                  type="button"
                  disabled={isCheckoutLoading || isPending}
                  onClick={handleCheckout}
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-violet-600 px-6 py-4 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                >
                  {isCheckoutLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    isPending ? "Chưa mở bán" : "Pay Now"
                  )}
                </button>
                {isPending ? (
                  <p className="mt-3 text-sm text-slate-500">{previewNotice}</p>
                ) : null}
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
        <div className={`fixed right-4 top-24 z-[70] max-w-sm rounded-2xl border bg-white px-4 py-3 shadow-xl ${
          toast.type === "info" ? "border-sky-200" : "border-amber-200"
        }`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${
              toast.type === "info" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
            }`}>
              <AlertTriangle size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{toast.title || "Seat conflict"}</p>
              <p className="mt-1 text-sm text-slate-600">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
