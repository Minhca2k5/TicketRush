import { memo, useMemo } from "react";
import { SeatItem } from "./SeatItem";

export function SeatMap({ seats, seatLayout, selectedSeats, onSeatSelect }) {
  const selectedIds = useMemo(() => new Set(selectedSeats.map((seat) => seat.id)), [selectedSeats]);

  const groupedZones = useMemo(() => {
    const seatLookup = new Map(seats.map((seat) => [seat.id, seat]));

    if (seatLayout?.zones?.length) {
      return seatLayout.zones.map((zone) => ({
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        zoneDescription: zone.zoneDescription,
        tierName: zone.tierName,
        price: zone.price,
        rows: (zone.rows || [])
          .map((row) => ({
            rowName: row.rowName,
            seats: (row.seats || [])
              .map((seat) => seatLookup.get(seat.id))
              .filter(Boolean)
              .sort((first, second) => first.number - second.number),
          }))
          .filter((row) => row.seats.length),
      }));
    }

    const zoneMap = seats.reduce((acc, seat) => {
      const zoneName = seat.zone || "General";
      if (!acc.has(zoneName)) {
        acc.set(zoneName, { zoneId: zoneName, zoneName, rowsMap: new Map() });
      }
      const zone = acc.get(zoneName);
      if (!zone.rowsMap.has(seat.row)) {
        zone.rowsMap.set(seat.row, []);
      }
      zone.rowsMap.get(seat.row).push(seat);
      return acc;
    }, new Map());

    return Array.from(zoneMap.values()).map((zone) => ({
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      rows: Array.from(zone.rowsMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([rowName, rowSeats]) => ({
          rowName,
          seats: rowSeats.sort((first, second) => first.number - second.number),
        })),
    }));
  }, [seatLayout, seats]);

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Interactive Seat Map</h3>
          <p className="text-sm text-slate-500">Scroll horizontally on smaller screens and tap seats to reserve them.</p>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden pb-2">
        <div className="mx-auto min-w-[760px] rounded-[24px] bg-[linear-gradient(180deg,#fafbff_0%,#f3f5ff_100%)] p-6 md:p-8">
          {groupedZones.length ? (
            <div className="space-y-8">
              {groupedZones.map((zone) => (
                <section key={zone.zoneId} className="rounded-[22px] border border-violet-100 bg-white/80 p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">{zone.zoneName}</h4>
                      <p className="text-sm text-slate-500">
                        {zone.zoneDescription || "Select available seats from this section."}
                      </p>
                    </div>
                    <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
                      {zone.tierName || zone.zoneName}{zone.price ? ` · $${zone.price.toLocaleString()}` : ""}
                    </div>
                  </div>

                  <div className="space-y-3">
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
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/70 px-6 py-10 text-center text-sm text-slate-500">
              Seat inventory is not available for this event yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SeatRow = memo(function SeatRow({ row, selectedIds, onSeatSelect }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3">
      <span className="text-center text-sm font-bold text-slate-500">{row.rowName}</span>
      <div className="grid auto-cols-max grid-flow-col justify-start gap-2">
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
      <span className="text-center text-sm font-bold text-slate-500">{row.rowName}</span>
    </div>
  );
}, (prev, next) => {
  if (prev.row.seats.length !== next.row.seats.length) {
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
});
