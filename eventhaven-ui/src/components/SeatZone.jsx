import { memo } from "react";
import { SeatItem } from "./SeatItem";

export const SeatZone = memo(function SeatZone({ zone, selectedIds, onSeatSelect }) {
  return (
    <section className="w-full overflow-hidden rounded-[22px] border border-violet-100 bg-white/85 p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h4 className="text-lg font-black text-slate-950">{zone.zoneName}</h4>
          <p className="mt-1 text-sm text-slate-500">
            {zone.zoneDescription || "Select available seats from this section."}
          </p>
        </div>
        <div className="inline-flex self-start rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
          {zone.tierName || zone.zoneName}{zone.price ? ` · $${zone.price.toLocaleString()}` : ""}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {zone.rows.map((row) => (
          <SeatRow
            key={`${zone.zoneId}-${row.rowName}`}
            row={row}
            selectedIds={selectedIds}
            onSeatSelect={onSeatSelect}
          />
        ))}
      </div>
    </section>
  );
}, areZonesEqual);

const SeatRow = memo(function SeatRow({ row, selectedIds, onSeatSelect }) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3">
      <span className="flex h-11 items-center justify-center text-sm font-bold text-slate-500">
        {row.rowName}
      </span>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-max items-center gap-2">
          {row.seats.map((seat, index) => (
            <div key={seat.id} className={index === Math.ceil(row.seats.length / 2) ? "ml-4 md:ml-6" : ""}>
              <SeatItem
                seat={seat}
                isSelected={selectedIds.has(seat.id)}
                onToggle={onSeatSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}, areRowsEqual);

function areZonesEqual(prev, next) {
  if (prev.zone.zoneId !== next.zone.zoneId || prev.zone.rows.length !== next.zone.rows.length) {
    return false;
  }

  for (let index = 0; index < prev.zone.rows.length; index += 1) {
    if (!areRowsEqual(
      { row: prev.zone.rows[index], selectedIds: prev.selectedIds },
      { row: next.zone.rows[index], selectedIds: next.selectedIds }
    )) {
      return false;
    }
  }

  return true;
}

function areRowsEqual(prev, next) {
  if (prev.row.rowName !== next.row.rowName || prev.row.seats.length !== next.row.seats.length) {
    return false;
  }

  for (let index = 0; index < prev.row.seats.length; index += 1) {
    const prevSeat = prev.row.seats[index];
    const nextSeat = next.row.seats[index];

    if (
      prevSeat.id !== nextSeat.id ||
      prevSeat.status !== nextSeat.status ||
      prevSeat.pending !== nextSeat.pending ||
      prevSeat.lockHolder !== nextSeat.lockHolder ||
      prevSeat.lockExpiresAt !== nextSeat.lockExpiresAt ||
      prev.selectedIds.has(prevSeat.id) !== next.selectedIds.has(nextSeat.id)
    ) {
      return false;
    }
  }

  return true;
}
