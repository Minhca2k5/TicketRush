// Zone types matching backend VenueZone name
export type ZoneType = "VIP" | "Standard" | "vip" | "standard";

export type SeatStatus = "AVAILABLE" | "SOLD" | "LOCKED";

export interface Seat {
  id: number;
  row: string;        // "A", "B", ...
  number: number;     // 1, 2, ...
  zone: ZoneType;
  price: number;
  status: SeatStatus;
}

// Convert backend seat data to Seat type
export function mapSeatsToType(backendSeats: any[]): Seat[] {
  return backendSeats.map((s) => {
    const seatNumber = s.seatNumber; // "A1"
    const row = seatNumber.charAt(0);
    const number = parseInt(seatNumber.slice(1), 10);
    const zone = s.venueZone?.name || "Standard";
    const price = s.priceTier?.price || 0;
    const status = s.status as SeatStatus;
    return {
      id: s.id,
      row,
      number,
      zone: zone as ZoneType,
      price,
      status,
    };
  });
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
        zone: "VIP",
        price: 500000,
        status: "AVAILABLE",
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
        zone: "Standard",
        price: 200000,
        status: "AVAILABLE",
      });
    }
  }
  return seats;
}
