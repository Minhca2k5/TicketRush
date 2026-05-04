// Zone types matching backend VenueZone name
export type ZoneType = "VIP" | "Standard" | "vip" | "standard" | string;

export type SeatStatus = "AVAILABLE" | "SOLD" | "LOCKED";

export interface Seat {
  id: number;
  row: string;        // "A", "B", ...
  number: number;     // 1, 2, ...
  seatLabel: string;
  zone: ZoneType;
  price: number;
  status: SeatStatus;
  lockHolder?: string | null;
  lockExpiresAt?: string | null;
}

function parseRowLabel(seatNumber: string, explicitRow?: string | null): string {
  if (explicitRow && String(explicitRow).trim()) {
    return String(explicitRow).trim();
  }

  const hyphenParts = seatNumber.split("-");
  if (hyphenParts.length > 1 && hyphenParts[0]) {
    return hyphenParts[0];
  }

  const matched = seatNumber.match(/^[A-Za-z]+/);
  return matched?.[0] || seatNumber.charAt(0) || "A";
}

function parseSeatIndex(seatNumber: string): number {
  const hyphenParts = seatNumber.split("-");
  const raw = hyphenParts.length > 1
    ? hyphenParts[hyphenParts.length - 1]
    : seatNumber.replace(/^[^0-9]+/, "");
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

export interface SeatZoneLayout {
  zoneId: number;
  zoneName: string;
  zoneDescription?: string;
  tierName?: string;
  price?: number;
  seatCount?: number;
  rows: Array<{
    rowName: string;
    seats: any[];
  }>;
}

export interface SeatLayoutSummary {
  eventId: number;
  eventName: string;
  venue?: {
    id?: string;
    name?: string;
    address?: string;
    totalCapacity?: number;
  };
  totalSeats: number;
  availableSeats: number;
  bookedSeats: number;
  lockedSeats: number;
  zones: SeatZoneLayout[];
}

export function normalizeSeatStatus(status: string | undefined | null): SeatStatus {
  const normalized = String(status || "").trim().toUpperCase();
  if (["SOLD", "BOOKED", "UNAVAILABLE"].includes(normalized)) {
    return "SOLD";
  }
  if (["LOCKED", "WAITING", "HELD", "RESERVED", "IN_QUEUE"].includes(normalized)) {
    return "LOCKED";
  }
  return "AVAILABLE";
}

// Convert backend seat data to Seat type
export function mapSeatsToType(backendSeats: any[]): Seat[] {
  return backendSeats.map((s) => {
    const seatNumber = String(s.seatNumber || "");
    const row = parseRowLabel(seatNumber, s.rowName);
    const number = parseSeatIndex(seatNumber);
    const zone = s.venueZone?.name || "Standard";
    const price = s.priceTier?.price || 0;
    const status = normalizeSeatStatus(s.status);
    return {
      id: s.id,
      row,
      number,
      seatLabel: seatNumber || `${row}${number}`,
      zone: zone as ZoneType,
      price,
      status,
      lockHolder: s.lockHolder ?? null,
      lockExpiresAt: s.lockExpiresAt ?? null,
    };
  });
}

export function mapSeatLayoutToType(layout: any): { layout: SeatLayoutSummary | null; seats: Seat[] } {
  if (!layout || !Array.isArray(layout.zones)) {
    return { layout: null, seats: [] };
  }

  const zones: SeatZoneLayout[] = layout.zones.map((zone: any) => ({
    zoneId: zone.zoneId,
    zoneName: zone.zoneName || "Standard",
    zoneDescription: zone.zoneDescription,
    tierName: zone.tierName,
    price: zone.price != null ? Number(zone.price) : undefined,
    seatCount: zone.seatCount,
    rows: Array.isArray(zone.rows)
      ? zone.rows.map((row: any) => ({
        rowName: row.rowName || "Unknown",
        seats: Array.isArray(row.seats) ? row.seats : [],
      }))
      : [],
  }));

  const seats = zones.flatMap((zone) =>
    zone.rows.flatMap((row) =>
      row.seats.map((seat: any) => {
        const seatNumber = String(seat.seatNumber || "");
        const rowName = row.rowName || parseRowLabel(seatNumber, seat.rowName);
        const seatIndex = parseSeatIndex(seatNumber);
        return {
          id: seat.id,
          row: rowName,
          number: seatIndex,
          seatLabel: seatNumber || `${rowName}${seatIndex}`,
          zone: zone.zoneName,
          price: Number(seat.priceTier?.price ?? zone.price ?? 0),
          status: normalizeSeatStatus(seat.status),
          lockHolder: seat.lockHolder ?? null,
          lockExpiresAt: seat.lockExpiresAt ?? null,
        } satisfies Seat;
      })
    )
  );

  return {
    layout: {
      eventId: layout.eventId,
      eventName: layout.eventName,
      venue: layout.venue,
      totalSeats: Number(layout.totalSeats || seats.length),
      availableSeats: Number(layout.availableSeats || 0),
      bookedSeats: Number(layout.bookedSeats || 0),
      lockedSeats: Number(layout.lockedSeats || 0),
      zones,
    },
    seats,
  };
}

// Generate mock seats for preview (not used in prod)
export function generateSeats(): Seat[] {
  const seats: Seat[] = [];
  // VIP: rows A-E, 5 seats each
  for (let r = 0; r < 5; r++) {
    const row = String.fromCharCode(65 + r); // A, B, C, D, E
    for (let n = 1; n <= 5; n++) {
      seats.push({
        id: r * 100 + n,
        row,
        number: n,
        seatLabel: `${row}${n}`,
        zone: "VIP",
        price: 500000,
        status: "AVAILABLE",
        lockHolder: null,
        lockExpiresAt: null,
      });
    }
  }
  // Standard: rows F-J, 10 seats each
  for (let r = 0; r < 5; r++) {
    const row = String.fromCharCode(70 + r); // F, G, H, I, J
    for (let n = 1; n <= 10; n++) {
      seats.push({
        id: 500 + r * 100 + n,
        row,
        number: n,
        seatLabel: `${row}${n}`,
        zone: "Standard",
        price: 200000,
        status: "AVAILABLE",
        lockHolder: null,
        lockExpiresAt: null,
      });
    }
  }
  return seats;
}
