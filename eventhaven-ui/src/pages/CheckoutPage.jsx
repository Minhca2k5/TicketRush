import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Ticket, Clock3, AlertTriangle, Check, ShoppingBag, CreditCard, Sparkles, User, Mail, ShieldCheck, QrCode } from "lucide-react";
import { getEventById } from "../services/eventService";
import { checkout, validateCoupon, releaseSeat } from "../services/bookingService";
import { getProfile } from "../services/authService";
import { parseLockExpiresAt } from "../lib/seat-types";
import { getAccountHolderId, getStoredHolderId, setStoredHolderId } from "../lib/holder";
import { readStoredSelection, writeStoredSelection } from "../lib/selection-storage";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default function CheckoutPage() {
  const { id: eventIdStr } = useParams();
  const eventId = Number(eventIdStr);
  const navigate = useNavigate();

  // State
  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [holderId, setHolderId] = useState("");
  const [customerProfile, setCustomerProfile] = useState(null);

  // Form State
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Timer State
  const [remaining, setRemaining] = useState(600); // 10 minutes default
  const [timerStart, setTimerStart] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  // Checkout Status
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [completedOrderSnapshot, setCompletedOrderSnapshot] = useState(null);
  const [showHoldExpiredModal, setShowHoldExpiredModal] = useState(false);
  const [toast, setToast] = useState(null);

  const releaseExpiredInFlightRef = useRef(false);

  // 1. Fetch Customer Profile & Set Holder
  useEffect(() => {
    let isActive = true;
    getProfile()
      .then((profile) => {
        if (!isActive) return;
        setCustomerProfile(profile);
        setEmail(profile.email || "");
        setName(profile.username || "");

        // Determine holder ID
        const accountHolderId = getAccountHolderId(profile);
        if (accountHolderId) {
          setHolderId(accountHolderId);
          setStoredHolderId(accountHolderId);
        } else {
          // Fallback to local storage anonymous holder key
          const localHolder = getStoredHolderId();
          if (localHolder) setHolderId(localHolder);
        }
      })
      .catch(() => {
        if (!isActive) return;
        const localHolder = getStoredHolderId();
        if (localHolder) setHolderId(localHolder);
      });

    return () => {
      isActive = false;
    };
  }, []);

  // 2. Fetch Event Details
  useEffect(() => {
    if (!eventId) return;
    setLoadingEvent(true);
    getEventById(eventId)
      .then((data) => {
        setEvent(data);
      })
      .catch((err) => {
        setToast({ type: "warning", message: "Failed to load event details." });
      })
      .finally(() => {
        setLoadingEvent(false);
      });
  }, [eventId]);

  // 3. Hydrate Selection from LocalStorage
  useEffect(() => {
    if (!eventId || !holderId) return;

    const stored = readStoredSelection(eventId, holderId);
    if (!stored || !Array.isArray(stored.selectedSeats) || !stored.selectedSeats.length) {
      // No seats selected, redirect back to event details page
      navigate(`/events/${eventId}`);
      return;
    }

    setSelectedSeats(stored.selectedSeats);
    setExpiresAt(stored.expirationTime ? new Date(stored.expirationTime).toISOString() : null);

    // Calculate initial timer start
    const expTime = Number(stored.expirationTime || 0);
    if (expTime > Date.now()) {
      setTimerStart(expTime - 10 * 60 * 1000);
    } else {
      setTimerStart(Date.now());
    }

    // Auto-apply pre-selected coupon if any
    if (stored.couponCode && stored.couponCode.trim()) {
      const code = stored.couponCode.trim().toUpperCase();
      setCouponCode(code);
      const seatSubtotal = stored.selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0);
      setIsApplyingCoupon(true);
      validateCoupon(code, seatSubtotal)
        .then((response) => {
          const result = response?.data;
          if (result && result.valid) {
            setAppliedCoupon({
              code,
              discountAmount: result.discountAmount,
              finalPrice: result.finalPrice,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to auto-apply coupon", err);
        })
        .finally(() => {
          setIsApplyingCoupon(false);
        });
    }
  }, [eventId, holderId, navigate]);

  // 4. Timer Tick Logic
  useEffect(() => {
    if (!expiresAt && !timerStart) return;

    const tick = () => {
      if (expiresAt) {
        const expiresAtMs = parseLockExpiresAt(expiresAt);
        if (expiresAtMs > 0) {
          setRemaining(Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)));
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
  }, [expiresAt, timerStart]);

  // 5. Release seats when hold expires
  const handleReleaseSeats = useCallback(async () => {
    if (releaseExpiredInFlightRef.current || !eventId || !holderId || !selectedSeats.length) {
      return;
    }
    releaseExpiredInFlightRef.current = true;

    try {
      const seatIds = selectedSeats.map((s) => s.id);
      await Promise.allSettled(
        seatIds.map((seatId) => releaseSeat(eventId, seatId, holderId))
      );
      writeStoredSelection(eventId, holderId, null);
      setSelectedSeats([]);
      setShowHoldExpiredModal(true);
    } catch (err) {
      console.error("Failed to release expired seats", err);
    } finally {
      releaseExpiredInFlightRef.current = false;
    }
  }, [eventId, holderId, selectedSeats]);

  useEffect(() => {
    if ((expiresAt || timerStart) && selectedSeats.length && remaining === 0 && !checkoutSuccess) {
      handleReleaseSeats();
    }
  }, [expiresAt, remaining, selectedSeats.length, timerStart, handleReleaseSeats, checkoutSuccess]);

  // 6. Calculations
  const subtotal = useMemo(() => {
    return selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0);
  }, [selectedSeats]);

  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return Number(appliedCoupon.discountAmount || 0);
  }, [appliedCoupon]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 7. Apply Coupon Code
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode || !couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }
    setIsApplyingCoupon(true);
    setCouponError("");
    try {
      const response = await validateCoupon(couponCode.trim().toUpperCase(), subtotal);
      const result = response?.data;
      if (result && result.valid) {
        setAppliedCoupon({
          code: couponCode.trim().toUpperCase(),
          discountAmount: result.discountAmount,
          finalPrice: result.finalPrice,
        });
        setToast({ type: "success", message: "Coupon applied successfully!" });
      } else {
        setCouponError(response?.message || result?.message || "Invalid coupon code");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to validate coupon";
      setCouponError(errMsg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // 8. Payment & Checkout Submission
  const handlePayNow = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setToast({ type: "warning", message: "Please fill in all customer details." });
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const seatIds = selectedSeats.map((s) => s.id);
      const codeToApply = appliedCoupon ? appliedCoupon.code : "";
      const order = await checkout(
        eventId,
        seatIds,
        holderId,
        { email, name },
        codeToApply
      );

      // Snapshot checkout data before clearing seats
      setCompletedOrderSnapshot({
        seatLabels: selectedSeats.map((s) => s.seatLabel || s.label || s.id),
        totalPaid: Math.max(0, subtotal - (appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0)),
      });
      setOrderId(order.id);
      setCheckoutSuccess(true);
      writeStoredSelection(eventId, holderId, null); // Clear from local storage
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Checkout failed. Your session may have expired.";
      setToast({ type: "warning", message: errMsg });
    } finally {
      setIsCheckoutLoading(false);
    }
  }, [email, name, selectedSeats, holderId, eventId, appliedCoupon, subtotal]);

  // 9. Dev shortcut: Press \ to instantly pay
  const handlePayNowRef = useRef(handlePayNow);
  useEffect(() => {
    handlePayNowRef.current = handlePayNow;
  }, [handlePayNow]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "\\" && !checkoutSuccess && !isCheckoutLoading) {
        e.preventDefault();
        handlePayNowRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [checkoutSuccess, isCheckoutLoading]);

  // Remaining time formatter
  const formattedTime = useMemo(() => {
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [remaining]);

  if (loadingEvent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100 font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-400">Loading checkout details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased pb-24 relative overflow-hidden">
      {/* Background Decorative Blur Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 relative z-10">
        
        {/* Back Link */}
        <button
          onClick={() => navigate(`/events/${eventId}`)}
          className="group inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-100 transition mb-8"
        >
          <ArrowLeft size={16} className="transition group-hover:-translate-x-1" />
          Back to Seat Selection
        </button>

        {checkoutSuccess ? (
          /* ================= SUCCESS VIEW ================= */
          <div className="mx-auto max-w-lg rounded-[32px] bg-slate-950/70 border border-slate-800/80 p-10 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              <Check size={40} className="animate-bounce" />
            </div>
            <h2 className="mt-6 text-3xl font-black text-white tracking-tight">Payment Successful!</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              Your order <span className="font-extrabold text-violet-400">#{orderId}</span> has been confirmed. Your electronic tickets are ready.
            </p>
            <div className="mt-8 rounded-2xl bg-slate-900/60 p-6 border border-slate-800/50 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Event</span>
                <span className="font-bold text-slate-200">{event?.name || event?.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Seats</span>
                <span className="font-mono font-bold text-violet-300">
                  {completedOrderSnapshot?.seatLabels?.join(", ") || selectedSeats.map((s) => s.seatLabel || s.label || s.id).join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-extrabold text-green-400">{currencyFormatter.format(completedOrderSnapshot?.totalPaid ?? total)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="mt-8 w-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-sm font-extrabold text-white shadow-xl shadow-violet-500/20 transition duration-200 hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-0.5 hover:shadow-violet-500/30"
            >
              View My Tickets
            </button>
          </div>
        ) : (
          /* ================= DUAL COLUMN CHECKOUT FLOW ================= */
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
            
            {/* LEFT COLUMN: ORDER DETAILS & CLIENT DETAILS */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Event Card Summary */}
              <div className="rounded-[32px] bg-slate-950/65 border border-slate-800/60 p-6 sm:p-8 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row gap-6">
                {event?.imageUrl && (
                  <img
                    src={event.imageUrl}
                    alt={event.name || event.title}
                    className="w-full sm:w-32 h-32 object-cover rounded-2xl bg-slate-800 border border-slate-800"
                  />
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <span className="inline-block bg-violet-500/10 text-violet-400 text-xs font-extrabold px-3 py-1 rounded-full border border-violet-500/20 mb-2">
                      {event?.category || "Live Event"}
                    </span>
                    <h1 className="text-2xl font-black text-white">{event?.name || event?.title}</h1>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-1">{event?.venueName || "Venue Venue"}</p>
                  </div>
                  <div className="text-xs text-slate-500 mt-4 border-t border-slate-800/50 pt-3 flex flex-wrap gap-4">
                    <span>Date: <strong className="text-slate-300">{event?.date || "TBD"}</strong></span>
                    <span>Time: <strong className="text-slate-300">{event?.time || "TBD"}</strong></span>
                  </div>
                </div>
              </div>

              {/* Selected Seats Details */}
              <div className="rounded-[32px] bg-slate-950/65 border border-slate-800/60 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                  <Ticket size={20} className="text-violet-400" />
                  Review Your Selected Seats
                </h3>
                <div className="mt-6 divide-y divide-slate-800/80">
                  {selectedSeats.map((seat) => (
                    <div key={seat.id} className="flex justify-between items-center py-4 first:pt-0 last:pb-0">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-base font-black text-slate-200">
                            Seat {seat.seatLabel || seat.label || seat.id}
                          </span>
                          <span className="bg-slate-800/80 text-slate-400 text-xs font-semibold px-2 py-0.5 rounded border border-slate-700/50">
                            {seat.zoneName || "Standard Zone"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Status: Locked / Expires soon</p>
                      </div>
                      <span className="font-bold text-slate-300">
                        {currencyFormatter.format(seat.price || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Details Form */}
              <div className="rounded-[32px] bg-slate-950/65 border border-slate-800/60 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                  <User size={20} className="text-violet-400" />
                  Billing Information
                </h3>
                <p className="text-xs text-slate-500 mt-1">Tickets will be delivered to this customer profile.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-100 outline-none transition"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-100 outline-none transition"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: TIMER, PAYMENT DETAILS, SUBMISSION */}
            <div className="lg:col-span-5 space-y-8 sticky top-24">

              {/* Timer Alert */}
              <div className="rounded-[28px] bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 animate-pulse">
                    <Clock3 size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">Seats Locked</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Please complete purchase before expires.</p>
                  </div>
                </div>
                <span className="font-mono text-2xl font-black text-amber-400 bg-slate-900/80 px-4 py-1.5 rounded-2xl border border-slate-800">
                  {formattedTime}
                </span>
              </div>

              {/* Coupon Code Input */}
              <div className="rounded-[32px] bg-slate-950/65 border border-slate-800/60 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles size={16} className="text-violet-400" />
                  Have a Promo Code?
                </h3>
                
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-2xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold uppercase tracking-wider bg-green-500/20 text-green-300 px-2 py-0.5 rounded text-xs animate-pulse">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-xs font-bold">Applied Successfully</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SUMMER20"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl px-4 py-3 text-sm text-slate-100 outline-none transition placeholder-slate-600 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || !couponCode.trim()}
                      className="shrink-0 rounded-2xl bg-violet-600 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isApplyingCoupon ? "Applying..." : "Apply"}
                    </button>
                  </form>
                )}
                {couponError && (
                  <p className="mt-2 text-xs font-semibold text-red-400 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    {couponError}
                  </p>
                )}
              </div>

              {/* Bank QR Transfer Payment Box */}
              <div className="rounded-[32px] bg-slate-950/65 border border-slate-800/60 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                  <QrCode size={20} className="text-violet-400" />
                  Chuyển khoản ngân hàng
                </h3>
                <p className="text-xs text-slate-500 mt-1">Quét mã QR bằng ứng dụng ngân hàng hoặc chuyển khoản thủ công theo thông tin bên dưới.</p>
                
                {/* Styled CSS animation in block */}
                <style>{`
                  @keyframes scan {
                    0%, 100% { top: 4%; }
                    50% { top: 96%; }
                  }
                  .animate-scan {
                    animation: scan 2.5s ease-in-out infinite;
                  }
                `}</style>
                
                {/* QR Code Scan Area — Placeholder VietQR-style */}
                <div className="relative mt-6 mb-8 p-6 rounded-3xl bg-slate-900 border border-slate-800 select-none overflow-hidden max-w-sm mx-auto">
                  {/* Laser Scan line */}
                  <div className="absolute left-0 right-0 h-[2.5px] bg-emerald-500 shadow-[0_0_10px_#10b981,0_0_20px_#10b981] animate-scan pointer-events-none" />
                  
                  {/* Placeholder VietQR SVG Mock */}
                  <svg className="w-48 h-48 mx-auto bg-white p-3.5 rounded-2xl shadow-inner border border-slate-200" viewBox="0 0 100 100">
                    {/* QR corner markers */}
                    <rect x="5" y="5" width="25" height="25" fill="#1e1b4b" rx="2" />
                    <rect x="10" y="10" width="15" height="15" fill="white" rx="1" />
                    <rect x="13" y="13" width="9" height="9" fill="#4f46e5" rx="0.5" />

                    <rect x="70" y="5" width="25" height="25" fill="#1e1b4b" rx="2" />
                    <rect x="75" y="10" width="15" height="15" fill="white" rx="1" />
                    <rect x="78" y="13" width="9" height="9" fill="#4f46e5" rx="0.5" />

                    <rect x="5" y="70" width="25" height="25" fill="#1e1b4b" rx="2" />
                    <rect x="10" y="75" width="15" height="15" fill="white" rx="1" />
                    <rect x="13" y="78" width="9" height="9" fill="#4f46e5" rx="0.5" />

                    {/* Data patterns */}
                    <path d="M 35 5 H 40 V 10 H 35 Z M 45 5 H 50 V 15 H 45 Z M 55 5 H 65 V 10 H 55 Z M 35 15 H 45 V 20 H 35 Z M 50 15 H 60 V 20 H 50 Z M 60 10 H 65 V 15 H 60 Z M 35 25 H 40 V 30 H 35 Z M 45 25 H 55 V 30 H 45 Z M 60 25 H 65 V 35 H 60 Z" fill="#1e1b4b" />
                    <path d="M 5 35 H 15 V 40 H 5 Z M 20 35 H 30 V 45 H 20 Z M 35 35 H 40 V 40 H 35 Z M 45 35 H 55 V 45 H 45 Z M 5 45 H 10 V 50 H 5 Z M 15 45 H 20 V 55 H 15 Z M 25 45 H 35 V 50 H 25 Z" fill="#1e1b4b" />
                    <path d="M 5 55 H 15 V 60 H 5 Z M 20 55 H 25 V 65 H 20 Z M 30 55 H 40 V 60 H 30 Z M 45 55 H 50 V 60 H 45 Z M 55 55 H 65 V 65 H 55 Z M 5 65 H 10 V 70 H 5 Z M 15 65 H 20 V 70 H 15 Z M 25 65 H 30 V 70 H 25 Z M 35 65 H 50 V 70 H 35 Z" fill="#1e1b4b" />
                    <path d="M 35 75 H 40 V 85 H 35 Z M 45 75 H 55 V 80 H 45 Z M 60 75 H 65 V 85 H 60 Z M 45 85 H 50 V 95 H 45 Z M 55 85 H 65 V 90 H 55 Z M 35 90 H 40 V 95 H 35 Z M 50 90 H 55 V 95 H 50 Z" fill="#1e1b4b" />
                    <path d="M 75 35 H 85 V 40 H 75 Z M 90 35 H 95 V 45 H 90 Z M 80 45 H 85 V 50 H 80 Z M 70 50 H 75 V 60 H 70 Z M 85 55 H 95 V 60 H 85 Z M 75 60 H 85 V 65 H 75 Z M 90 60 H 95 V 70 H 90 Z" fill="#1e1b4b" />
                    
                    {/* Center VietQR logo placeholder */}
                    <rect x="42" y="42" width="16" height="16" fill="#1e1b4b" rx="3" />
                    <rect x="44" y="44" width="12" height="12" fill="#4f46e5" rx="2" />
                    <text x="50" y="53" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">VN</text>
                  </svg>
                  
                  {/* Scan overlay guide */}
                  <p className="mt-4 text-[11px] font-bold text-center text-slate-500 uppercase tracking-widest animate-pulse">
                    Quét mã QR để thanh toán
                  </p>
                </div>

                {/* Transfer Info Details — Vietnamese Banking */}
                <div className="space-y-3.5 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 mb-6 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Ngân hàng</span>
                    <span className="font-extrabold text-slate-200">Vietcombank (VCB)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Chủ tài khoản</span>
                    <span className="font-bold text-slate-200 uppercase">CONG TY TNHH TICKETRUSH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Số tài khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">1234 5678 9012</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("123456789012");
                          setToast({ type: "success", message: "Đã sao chép số tài khoản!" });
                        }}
                        className="text-[10px] font-extrabold text-violet-400 hover:text-violet-300 hover:underline px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Số tiền</span>
                    <span className="font-mono font-black text-green-400">{currencyFormatter.format(total)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Nội dung CK</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-violet-300 bg-violet-950/40 border border-violet-800/40 px-2 py-0.5 rounded">
                        TR{eventId}S{selectedSeats.map(s => s.seatLabel || s.label || s.id).join("")}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const msg = `TR${eventId}S${selectedSeats.map(s => s.seatLabel || s.label || s.id).join("")}`;
                          navigator.clipboard.writeText(msg);
                          setToast({ type: "success", message: "Đã sao chép nội dung chuyển khoản!" });
                        }}
                        className="text-[10px] font-extrabold text-violet-400 hover:text-violet-300 hover:underline px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                </div>


                <form onSubmit={handlePayNow} className="space-y-4">
                  {/* Pricing Breakdown */}
                  <div className="pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>Tạm tính</span>
                      <span>{currencyFormatter.format(subtotal)}</span>
                    </div>

                    {appliedCoupon && (
                      <div className="flex items-center justify-between text-sm text-green-400 font-semibold">
                        <span>Giảm giá ({appliedCoupon.code})</span>
                        <span>-{currencyFormatter.format(discount)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-base font-black text-white pt-3 border-t border-slate-800/60">
                      <span>Tổng cộng</span>
                      <span className="text-xl text-violet-400">{currencyFormatter.format(total)}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCheckoutLoading}
                    className="mt-6 w-full flex justify-center items-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-sm font-extrabold text-white shadow-xl shadow-violet-500/20 transition duration-200 hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-0.5 hover:shadow-violet-500/30 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isCheckoutLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      "Tôi đã chuyển khoản"
                    )}
                  </button>
                </form>
              </div>

            </div>

          </div>
        )}
      </div>

      {/* Timer Expired Modal overlay */}
      {showHoldExpiredModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
          <div className="relative w-full max-w-md rounded-[32px] bg-slate-900 border border-slate-800 p-8 text-center shadow-2xl">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <AlertTriangle size={30} />
            </div>
            <h3 className="mt-5 text-2xl font-black text-white">Your Seat Hold Expired</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              You did not complete the payment within the 10-minute hold limit. Your selected seats have been released back to the event inventory.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowHoldExpiredModal(false);
                navigate(`/events/${eventId}`);
              }}
              className="mt-6 w-full rounded-full bg-violet-600 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-violet-500"
            >
              Return to Seat Selection
            </button>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="fixed right-4 top-24 z-[70] max-w-sm rounded-2xl border border-violet-800/80 bg-slate-950/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400">
              {toast.type === "success" ? <Check size={18} /> : <AlertTriangle size={18} />}
            </div>
            <p className="text-sm font-bold text-slate-200">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
