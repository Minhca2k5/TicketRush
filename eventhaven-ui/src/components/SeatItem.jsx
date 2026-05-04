import { memo } from "react";
import { cn } from "@/lib/utils";

function SeatItemComponent({ seat, isSelected, onToggle }) {
  const disabled = seat.pending || (seat.status !== "AVAILABLE" && !isSelected);

  const seatClass = cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-[12px] border text-[11px] font-bold transition-all duration-150 md:h-11 md:w-11",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2",
    seat.pending && "cursor-wait opacity-60",
    seat.status === "SOLD" && "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400",
    seat.status === "LOCKED" && "cursor-not-allowed border-amber-300 bg-amber-100 text-amber-700",
    seat.status === "AVAILABLE" && !isSelected && "border-violet-200 bg-white text-violet-700 hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md",
    isSelected && "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/20"
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onToggle(seat)}
      title={`${seat.row}${seat.number} - ${seat.zone}${seat.pending ? " - updating" : ""}`}
      className={seatClass}
      aria-pressed={isSelected}
      aria-label={`Seat ${seat.row}${seat.number}, ${seat.zone}`}
    >
      {seat.number}
    </button>
  );
}

export const SeatItem = memo(
  SeatItemComponent,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.seat.id === next.seat.id &&
    prev.seat.status === next.seat.status &&
    prev.seat.pending === next.seat.pending &&
    prev.seat.lockHolder === next.seat.lockHolder &&
    prev.seat.lockExpiresAt === next.seat.lockExpiresAt
);
