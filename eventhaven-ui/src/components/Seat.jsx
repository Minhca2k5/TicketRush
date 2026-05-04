import { cn } from "@/lib/utils";

export function Seat({ seat, isSelected, onSelect }) {
  const disabled = seat.pending || (seat.status !== "AVAILABLE" && !isSelected);

  const seatClass = cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-bold transition md:h-11 md:w-11",
    seat.pending && "cursor-wait opacity-60",
    seat.status === "SOLD" && "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400",
    seat.status === "LOCKED" && "cursor-not-allowed border-amber-400 bg-amber-300 text-amber-900",
    seat.status === "AVAILABLE" && !isSelected && "border-2 border-violet-400 bg-white text-violet-700 hover:-translate-y-0.5 hover:shadow-md",
    isSelected && "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/25"
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onSelect(seat)}
      title={`${seat.row}${seat.number} - ${seat.zone}${seat.pending ? " - updating" : ""}`}
      className={seatClass}
    >
      {seat.number}
    </button>
  );
}
