"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { mapSeatsToType } from "@/lib/seat-types";
import { EventHeader } from "./EventHeader";
import { Stage } from "./Stage";
import { SeatMap } from "./SeatMap";
import { Legend } from "./Legend";
import { BookingCart } from "./BookingCart";
import { ShoppingCart, X, Check } from "lucide-react";

export function SeatSelector({ event, seats: backendSeats }) {
  const [seats, setSeats] = useState(() => mapSeatsToType(backendSeats || []));
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [timerStart, setTimerStart] = useState(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);

  useEffect(() => {
    const mappedSeats = mapSeatsToType(backendSeats || []);
    setSeats(mappedSeats);
    setSelectedSeats((current) =>
      current.filter((selected) =>
        mappedSeats.some((seat) => seat.id === selected.id && seat.status === "AVAILABLE"),
      ),
    );
  }, [backendSeats]);

  const handleSeatSelect = useCallback((seat) => {
    setSelectedSeats((prev) => {
      const isSelected = prev.some((s) => s.id === seat.id);
      if (isSelected) {
        const newSelection = prev.filter((s) => s.id !== seat.id);
        if (newSelection.length === 0) {
          setTimerStart(null);
        }
        return newSelection;
      } else {
        if (prev.length === 0) {
          setTimerStart(Date.now());
        }
        return [...prev, seat];
      }
    });
  }, []);

  const handleRemoveSeat = useCallback((seat) => {
    setSelectedSeats((prev) => {
      const newSelection = prev.filter((s) => s.id !== seat.id);
      if (newSelection.length === 0) {
        setTimerStart(null);
      }
      return newSelection;
    });
  }, []);

  const handleBookNow = useCallback(() => {
    setShowBookingConfirm(true);
  }, []);

  const total = useMemo(() => {
    return selectedSeats.reduce((sum, s) => sum + s.price, 0);
  }, [selectedSeats]);

  return (
    <div className="min-h-screen bg-background">
      <EventHeader event={event} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            <Stage />

            <div className="overflow-x-auto pb-4">
              <SeatMap
                seats={seats}
                selectedSeats={selectedSeats}
                onSeatSelect={handleSeatSelect}
              />
            </div>

            <Legend />
          </div>

          {/* Desktop Cart Sidebar */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24">
              <BookingCart
                selectedSeats={selectedSeats}
                onRemoveSeat={handleRemoveSeat}
                onBookNow={handleBookNow}
                timerStart={timerStart}
                total={total}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Cart Button */}
      {selectedSeats.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 lg:hidden z-40">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 shadow-lg shadow-primary/20 flex items-center justify-center"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            View Cart ({selectedSeats.length})
          </button>
        </div>
      )}

      {/* Mobile Cart Modal */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowMobileCart(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto bg-card rounded-t-2xl border-t border-border">
            <div className="sticky top-0 bg-card backdrop-blur-sm p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Your Cart</h2>
              <button
                onClick={() => setShowMobileCart(false)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <BookingCart
                selectedSeats={selectedSeats}
                onRemoveSeat={handleRemoveSeat}
                onBookNow={handleBookNow}
                timerStart={timerStart}
                total={total}
              />
            </div>
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {showBookingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowBookingConfirm(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Booking Initiated!
            </h2>
            <p className="text-muted-foreground mb-6">
              Your {selectedSeats.length} seat(s) have been reserved. In a real
              application, you would now proceed to payment.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowBookingConfirm(false)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg font-medium"
              >
                Continue Browsing
              </button>
              <button
                variant="outline"
                onClick={() => {
                  setShowBookingConfirm(false);
                  setSelectedSeats([]);
                  setTimerStart(null);
                }}
                className="w-full border border-border bg-background hover:bg-secondary text-foreground py-2 rounded-lg font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
