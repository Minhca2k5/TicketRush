import { useMemo } from "react";
import { Seat } from "./Seat";
import { cn } from "@/lib/utils";

export function SeatMap({ seats, selectedSeats, onSeatSelect }) {
  const selectedIds = useMemo(
    () => new Set(selectedSeats.map((s) => s.id)),
    [selectedSeats]
  );

  const vipSeats = useMemo(
    () => seats.filter((s) => s.zone === "VIP" || s.zone === "vip"),
    [seats]
  );

  const standardSeats = useMemo(
    () => seats.filter((s) => s.zone === "Standard" || s.zone === "standard"),
    [seats]
  );

  const groupByRow = (seatList) => {
    return seatList.reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {});
  };

  const vipRows = groupByRow(vipSeats);
  const standardRows = groupByRow(standardSeats);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      {/* VIP Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <span className="px-4 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full uppercase tracking-wider">
            VIP Zone
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </div>

        {Object.entries(vipRows).map(([row, rowSeats]) => (
          <SeatRow
            key={row}
            row={row}
            seats={rowSeats}
            selectedIds={selectedIds}
            onSeatSelect={onSeatSelect}
            isVip
          />
        ))}
      </div>

      {/* Aisle divider */}
      <div className="flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="px-4 py-1 text-muted-foreground text-xs uppercase tracking-wider">
          Aisle
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Standard Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
          <span className="px-4 py-1 bg-secondary/30 text-secondary-foreground text-xs font-semibold rounded-full uppercase tracking-wider">
            Standard Zone
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
        </div>

        {Object.entries(standardRows).map(([row, rowSeats]) => (
          <SeatRow
            key={row}
            row={row}
            seats={rowSeats}
            selectedIds={selectedIds}
            onSeatSelect={onSeatSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SeatRow({ row, seats, selectedIds, onSeatSelect, isVip }) {
  const sortedSeats = [...seats].sort((a, b) => a.number - b.number);
  const midpoint = Math.ceil(sortedSeats.length / 2);
  const leftSeats = sortedSeats.slice(0, midpoint);
  const rightSeats = sortedSeats.slice(midpoint);

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4">
      <span
        className={cn(
          "w-6 text-center text-sm font-semibold",
          isVip ? "text-primary" : "text-muted-foreground"
        )}
      >
        {row}
      </span>

      <div className="flex items-center gap-1">
        {leftSeats.map((seat) => (
          <Seat
            key={seat.id}
            seat={seat}
            isSelected={selectedIds.has(String(seat.id))}
            onSelect={onSeatSelect}
          />
        ))}
      </div>

      {/* Center aisle */}
      <div className="w-4 md:w-8" />

      <div className="flex items-center gap-1">
        {rightSeats.map((seat) => (
          <Seat
            key={seat.id}
            seat={seat}
            isSelected={selectedIds.has(String(seat.id))}
            onSelect={onSeatSelect}
          />
        ))}
      </div>

      <span
        className={cn(
          "w-6 text-center text-sm font-semibold",
          isVip ? "text-primary" : "text-muted-foreground"
        )}
      >
        {row}
      </span>
    </div>
  );
}
