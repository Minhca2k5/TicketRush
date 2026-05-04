import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { getSeatMap } from '../../services/eventService';
import { mapSeatsToType } from '../../lib/seat-types';

function formatSyncTime(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function seatStatusLabel(status) {
  if (status === 'SOLD') return 'Sold';
  if (status === 'LOCKED') return 'Locked';
  return 'Available';
}

function seatStatusClass(status) {
  if (status === 'SOLD') {
    return 'border-slate-300 bg-slate-200 text-slate-400';
  }
  if (status === 'LOCKED') {
    return 'border-amber-300 bg-amber-100 text-amber-700';
  }
  return 'border-violet-200 bg-white text-violet-700';
}

function AdminSeatLegend() {
  const legendItems = [
    { label: 'Available', className: 'border-2 border-violet-300 bg-white' },
    { label: 'Sold', className: 'border border-slate-300 bg-slate-200' },
    { label: 'Locked', className: 'border border-amber-300 bg-amber-100' },
  ];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
      <h3 className="text-sm font-bold text-slate-900">Seat Legend</h3>
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
        {legendItems.map((item) => (
          <div key={item.label} className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm">
            <span className={`inline-block h-5 w-5 rounded-md ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSeatCell({ seat }) {
  const tooltip = `Seat: ${seat.seatLabel || `${seat.row}${seat.number}`}
Row: ${seat.row}
Seat Number: ${seat.number}
Zone: ${seat.zone}
Status: ${seatStatusLabel(seat.status)}`;

  return (
    <div
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex h-10 w-10 shrink-0 cursor-default items-center justify-center rounded-[12px] border text-[11px] font-bold transition md:h-11 md:w-11 ${seatStatusClass(seat.status)}`}
    >
      {seat.number}
    </div>
  );
}

function AdminSeatZone({ zone }) {
  return (
    <section className="w-full rounded-[22px] border border-violet-100 bg-white/85 p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h4 className="text-lg font-black text-slate-950">{zone.zoneName}</h4>
          <p className="mt-1 text-sm text-slate-500">
            {zone.zoneDescription || 'Preview of the generated seat matrix for this venue zone.'}
          </p>
        </div>
        <div className="inline-flex self-start rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 md:self-auto">
          {zone.zoneName}{zone.price ? ` - $${zone.price.toLocaleString()}` : ''}
        </div>
      </div>

      <div className="mt-6 flex w-full flex-col items-center gap-4">
        {zone.rows.map((row) => (
          <div key={`${zone.zoneName}-${row.rowName}`} className="mb-4 w-full last:mb-0">
            <div className="w-full overflow-x-auto pb-1">
              <div className="flex min-w-max justify-center px-2">
                <div className="inline-flex items-center gap-3">
                  <span className="flex h-11 w-8 shrink-0 items-center justify-center text-sm font-bold text-slate-500">
                    {row.rowName}
                  </span>
                  <div className="inline-flex min-w-max flex-nowrap items-center gap-2">
                    {row.seats.map((seat, index) => (
                      <div key={seat.id} className={index === Math.ceil(row.seats.length / 2) ? 'ml-4 md:ml-6' : ''}>
                        <AdminSeatCell seat={seat} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminSeatMapPreview({ eventId }) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const loadSeatMap = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const payload = await getSeatMap(eventId);
      setSeats(mapSeatsToType(Array.isArray(payload) ? payload : []));
      setError('');
      setLastUpdatedAt(Date.now());
    } catch {
      setSeats([]);
      setError('Unable to load the current seat map from the Event Service.');
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!eventId) return;
    loadSeatMap();
  }, [eventId]);

  const groupedZones = useMemo(() => {
    const zoneMap = seats.reduce((accumulator, seat) => {
      const zoneName = seat.zone || 'General';
      if (!accumulator.has(zoneName)) {
        accumulator.set(zoneName, {
          zoneId: zoneName,
          zoneName,
          zoneDescription: '',
          price: seat.price || 0,
          rowsMap: new Map(),
        });
      }

      const zone = accumulator.get(zoneName);
      zone.price = zone.price || seat.price || 0;
      if (!zone.rowsMap.has(seat.row)) {
        zone.rowsMap.set(seat.row, []);
      }
      zone.rowsMap.get(seat.row).push(seat);
      return accumulator;
    }, new Map());

    return Array.from(zoneMap.values())
      .map((zone) => ({
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        zoneDescription: zone.zoneDescription,
        price: zone.price,
        rows: Array.from(zone.rowsMap.entries())
          .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
          .map(([rowName, rowSeats]) => ({
            rowName,
            seats: rowSeats.sort((first, second) => first.number - second.number),
          })),
      }))
      .filter((zone) => zone.rows.length);
  }, [seats]);

  const summary = useMemo(() => {
    return seats.reduce(
      (accumulator, seat) => {
        if (seat.status === 'SOLD') {
          accumulator.sold += 1;
        } else if (seat.status === 'LOCKED') {
          accumulator.locked += 1;
        } else {
          accumulator.available += 1;
        }
        return accumulator;
      },
      { available: 0, sold: 0, locked: 0 }
    );
  }, [seats]);

  return (
    <section className="mt-6 rounded-[32px] border border-[#dfe7f2] bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Venue Seat Map</h2>
          <p className="mt-2 text-sm text-slate-500">
            Read-only preview of the generated venue zones and live seat occupancy for this event.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Last updated {formatSyncTime(lastUpdatedAt)}
          </span>
          <button
            type="button"
            onClick={() => loadSeatMap({ silent: true })}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-sm md:p-6">
        <div className="rounded-[24px] bg-[linear-gradient(180deg,#fafbff_0%,#f3f5ff_100%)] p-4 md:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto flex h-20 max-w-2xl items-end justify-center rounded-t-[999px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-700 px-8 pb-5 text-center text-base font-black uppercase tracking-[0.38em] text-white shadow-[0_20px_45px_rgba(15,23,42,0.32)]">
              Stage
            </div>
            <p className="mt-4 text-center text-sm text-slate-500">
              Venue zones are shown below exactly as the generated seat matrix is currently stored.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              {summary.available} available
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {summary.sold} sold
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {summary.locked} locked
            </span>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
                Loading venue seat map...
              </div>
            ) : error ? (
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-700">
                <div className="inline-flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              </div>
            ) : groupedZones.length ? (
              <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">
                {groupedZones.map((zone) => (
                  <AdminSeatZone key={zone.zoneId} zone={zone} />
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
                No seat inventory has been generated for this event yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AdminSeatLegend />
      </div>
    </section>
  );
}
