import { cn } from "@/lib/utils";

export function Seat({ seat, isSelected, onSelect }) {
  const handleClick = () => {
    if (seat.status === "AVAILABLE") {
      onSelect(seat);
    }
  };

  const isVip = seat.zone === "VIP" || seat.zone === "vip";

  const seatClass = cn(
    "seat w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-xs font-semibold transition-all duration-200",
    seat.status === "SOLD"
      ? "seat-sold text-white cursor-not-allowed opacity-60"
      : seat.status === "LOCKED"
      ? "seat-locked text-white cursor-not-allowed"
      : isSelected
      ? "seat-selected text-white scale-105 ring-2 ring-primary ring-offset-2"
      : "seat-available text-white hover:scale-105 cursor-pointer",
    isVip && !isSelected ? "border-2 border-primary/30" : ""
  );

  return (
    <button
      className={seatClass}
      onClick={handleClick}
      disabled={seat.status !== "AVAILABLE"}
      title={`${seat.row}${seat.number} - ${seat.zone} ($${seat.price.toLocaleString()})`}
    >
      {seat.number}
    </button>
  );
}
