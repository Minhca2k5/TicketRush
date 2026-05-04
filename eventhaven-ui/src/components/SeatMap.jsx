import { useMemo } from "react";
import { SeatZone } from "./SeatZone";

export function SeatMap({ seats, seatLayout, selectedSeats, onSeatSelect }) {
  const selectedIds = useMemo(() => new Set(selectedSeats.map((seat) => seat.id)), [selectedSeats]);

  const groupedZones = useMemo(() => {
    const seatLookup = new Map(seats.map((seat) => [seat.id, seat]));

    if (seatLayout?.zones?.length) {
      return seatLayout.zones
        .map((zone) => ({
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
        }))
        .filter((zone) => zone.rows.length);
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

    return Array.from(zoneMap.values())
      .map((zone) => ({
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        rows: Array.from(zone.rowsMap.entries())
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([rowName, rowSeats]) => ({
            rowName,
            seats: rowSeats.sort((first, second) => first.number - second.number),
          })),
      }))
      .filter((zone) => zone.rows.length);
  }, [seatLayout, seats]);

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-sm md:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-900">Interactive Seat Map</h3>
        <p className="text-sm text-slate-500">Each section is grouped by zone and each row scrolls horizontally on smaller screens.</p>
      </div>

      <div className="rounded-[24px] bg-[linear-gradient(180deg,#fafbff_0%,#f3f5ff_100%)] p-4 md:p-6">
        {groupedZones.length ? (
          <div className="flex flex-col gap-8">
            {groupedZones.map((zone) => (
              <SeatZone
                key={zone.zoneId}
                zone={zone}
                selectedIds={selectedIds}
                onSeatSelect={onSeatSelect}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
            Seat inventory is not available for this event yet.
          </div>
        )}
      </div>
    </div>
  );
}
