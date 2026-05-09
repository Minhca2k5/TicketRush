const SOLD_STATUSES = new Set(['SOLD', 'BOOKED', 'UNAVAILABLE']);
const AVAILABLE_STATUSES = new Set(['AVAILABLE', 'OPEN']);

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function collectArray(target, value) {
  if (Array.isArray(value)) {
    target.push(...value);
  }
}

function collectSeatsFromRows(target, rows) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    collectArray(target, row?.seats);
  });
}

function collectZonePrices(target, zones) {
  if (!Array.isArray(zones)) return;

  zones.forEach((zone) => {
    [
      zone?.price,
      zone?.minPrice,
      zone?.min_price,
      zone?.priceTier?.price,
      zone?.tier?.price,
    ].forEach((value) => {
      const price = toNumber(value);
      if (price !== null) target.push(price);
    });

    collectZonePrices(target, zone?.zones);
    collectArray(target, zone?.priceTiers?.map((tier) => toNumber(tier?.price)).filter((price) => price !== null));
  });
}

function collectSeats(event) {
  const seats = [];
  collectArray(seats, event?.seats);
  collectArray(seats, event?.seatMap);
  collectArray(seats, event?.seatMap?.seats);

  const zoneSources = [
    event?.zones,
    event?.venue_zones,
    event?.seatLayout?.zones,
    event?.seatLayout?.venue_zones,
    event?.venue?.zones,
  ];

  zoneSources.forEach((zones) => {
    if (!Array.isArray(zones)) return;
    zones.forEach((zone) => {
      collectArray(seats, zone?.seats);
      collectSeatsFromRows(seats, zone?.rows);
    });
  });

  return seats;
}

function isSeatAvailable(seat) {
  const normalizedStatus = String(seat?.status || seat?.seatStatus || '').trim().toUpperCase();
  if (AVAILABLE_STATUSES.has(normalizedStatus)) return true;
  if (SOLD_STATUSES.has(normalizedStatus)) return false;
  if (seat?.available === true || seat?.isAvailable === true) return true;
  if (seat?.sold === true || seat?.booked === true || seat?.isSold === true) return false;
  return true;
}

function isSoldOut(event) {
  if (event?.soldOut === true || event?.isSoldOut === true) return true;

  const seats = collectSeats(event);
  if (seats.length > 0) {
    return seats.every((seat) => !isSeatAvailable(seat));
  }

  const zones = [
    event?.zones,
    event?.venue_zones,
    event?.seatLayout?.zones,
    event?.seatLayout?.venue_zones,
  ].find((items) => Array.isArray(items) && items.length);

  if (!zones) return false;

  return zones.every((zone) => {
    if (zone?.soldOut === true || zone?.isSoldOut === true) return true;
    const available = toNumber(zone?.availableSeats ?? zone?.remainingSeats ?? zone?.availableCount);
    if (available !== null) return available <= 0;
    const capacity = toNumber(zone?.seatCount ?? zone?.totalSeats ?? zone?.capacity);
    const sold = toNumber(zone?.soldSeats ?? zone?.bookedSeats ?? zone?.soldCount);
    return capacity !== null && sold !== null && capacity > 0 && sold >= capacity;
  });
}

export function getMinPrice(event) {
  const prices = [];

  collectZonePrices(prices, event?.zones);
  collectZonePrices(prices, event?.venue_zones);
  collectZonePrices(prices, event?.seatLayout?.zones);
  collectZonePrices(prices, event?.seatLayout?.venue_zones);
  collectZonePrices(prices, event?.venue?.zones);

  collectArray(prices, event?.priceTiers?.map((tier) => toNumber(tier?.price)).filter((price) => price !== null));

  const directPrices = [
    event?.minPrice,
    event?.min_price,
    event?.startingPrice,
    event?.starting_price,
    event?.priceTier?.price,
    event?.price,
  ]
    .map(toNumber)
    .filter((price) => price !== null);

  prices.push(...directPrices);

  if (!prices.length) return null;
  return Math.min(...prices);
}

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-US');
}

export function getEventPriceInfo(event) {
  if (isSoldOut(event)) {
    return {
      state: 'sold_out',
      label: 'Hết vé (Sold Out)',
      helper: 'Tickets unavailable',
      minPrice: null,
    };
  }

  const minPrice = getMinPrice(event);

  if (minPrice === null) {
    return {
      state: 'unknown',
      label: 'Price TBA',
      helper: 'Starting from',
      minPrice: null,
    };
  }

  if (minPrice === 0) {
    return {
      state: 'free',
      label: 'Miễn phí (Free)',
      helper: 'Starting from',
      minPrice,
    };
  }

  return {
    state: 'paid',
    label: `From $${formatCurrency(minPrice)}`,
    helper: 'Starting from',
    minPrice,
  };
}
