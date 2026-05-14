import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';

const DESIGN_WIDTH = 980;
const DESIGN_HEIGHT = 760;
const SEAT_SIZE = 24;
const ZONE_INSET_LEFT = 56;
const ZONE_INSET_RIGHT = 32;
const ZONE_INSET_TOP = 34;
const ZONE_INSET_BOTTOM = 34;
const STAGE_TO_ZONE_GAP = 100;
const ZONE_TO_ZONE_GAP = 60;
const ZONE_LABEL_SAFE_PADDING = 8;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_DELTA_NORMALIZER = 1400;
const ZOOM_LERP = 0.22;
const ROW_LABEL_SCREEN_GAP = 34;
const ZONE_TOOLTIP_HEIGHT = 34;

const statusColor = {
  AVAILABLE: { fill: '#ffffff', stroke: '#c4b5fd', text: '#6d28d9' },
  SELECTED: { fill: '#7c3aed', stroke: '#6d28d9', text: '#ffffff' },
  SOLD: { fill: '#e2e8f0', stroke: '#cbd5e1', text: '#64748b' },
  BOOKED: { fill: '#e2e8f0', stroke: '#cbd5e1', text: '#64748b' },
  LOCKED: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
  HELD: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
  RESERVED: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
};

function normalizeStatus(value) {
  return String(value || 'AVAILABLE').trim().toUpperCase();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function liveSeatKey(zoneName, seatNumber) {
  return `${String(zoneName || '').toLowerCase()}::${String(seatNumber || '').toLowerCase()}`;
}

function getSeatPrice(seat, zone) {
  return Number(seat?.priceTier?.price ?? zone?.price ?? 0);
}

function rotatePoint(point, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

function screenVectorToZoneLocal(point, zoneRotation) {
  return rotatePoint(point, -Number(zoneRotation || 0));
}

function getRotatedZoneClientRect(bounds, rotation) {
  const corners = getRotatedBoundsCorners(bounds, rotation);

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function getRotatedBoundsCorners(bounds, rotation) {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((corner) => rotatePoint(corner, rotation));
}

function getHorizontalSpanAtY(corners, y) {
  const intersections = [];

  corners.forEach((start, index) => {
    const end = corners[(index + 1) % corners.length];
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    if (start.y === end.y || y < minY || y >= maxY) return;

    const progress = (y - start.y) / (end.y - start.y);
    intersections.push(start.x + progress * (end.x - start.x));
  });

  if (intersections.length < 2) return null;
  intersections.sort((first, second) => first - second);
  return {
    minX: intersections[0],
    maxX: intersections[intersections.length - 1],
  };
}

function getSafeHorizontalSpan(corners, y, labelHeight, padding = ZONE_LABEL_SAFE_PADDING) {
  const sampleYs = [y - labelHeight / 2, y, y + labelHeight / 2];
  const spans = sampleYs.map((sampleY) => getHorizontalSpanAtY(corners, sampleY)).filter(Boolean);
  if (spans.length !== sampleYs.length) return null;

  const minX = Math.max(...spans.map((span) => span.minX)) + padding;
  const maxX = Math.min(...spans.map((span) => span.maxX)) - padding;
  return maxX > minX ? { minX, maxX, width: maxX - minX } : null;
}

function clampScreenAlignedPointInsideBounds(point, bounds, rotation, labelWidth, labelHeight) {
  const corners = getRotatedBoundsCorners(bounds, rotation);
  const clientRect = getRotatedZoneClientRect(bounds, rotation);
  const minY = clientRect.y + ZONE_LABEL_SAFE_PADDING + labelHeight / 2;
  const maxY = clientRect.y + clientRect.height - ZONE_LABEL_SAFE_PADDING - labelHeight / 2;
  const screenPoint = rotatePoint(point, rotation);
  let clampedY = Math.min(Math.max(screenPoint.y, minY), maxY);
  let span = getSafeHorizontalSpan(corners, clampedY, labelHeight);

  if (!span || span.width < labelWidth) {
    let best = null;
    for (let y = minY; y <= maxY; y += 2) {
      const candidate = getSafeHorizontalSpan(corners, y, labelHeight);
      if (!candidate) continue;
      const distance = Math.abs(y - screenPoint.y);
      if (!best || candidate.width > best.span.width || (candidate.width === best.span.width && distance < best.distance)) {
        best = { y, span: candidate, distance };
      }
    }
    if (best) {
      clampedY = best.y;
      span = best.span;
    }
  }

  if (!span) return point;

  const halfWidth = Math.min(labelWidth, span.width) / 2;
  const clampedX = Math.min(Math.max(screenPoint.x, span.minX + halfWidth), span.maxX - halfWidth);
  return screenVectorToZoneLocal({ x: clampedX, y: clampedY }, rotation);
}

function getRowLabelPosition(row, rotation) {
  if (Number.isFinite(Number(row.labelX)) && Number.isFinite(Number(row.labelY))) {
    return {
      x: Number(row.labelX),
      y: Number(row.labelY),
    };
  }

  const pointOnScreen = rotatePoint({ x: row.x, y: row.y }, rotation);
  const isSideways = isSidewaysRotation(rotation);
  const labelPointOnScreen = {
    x: pointOnScreen.x - (isSideways ? 0 : 34),
    y: pointOnScreen.y - (isSideways ? 28 : 0),
  };

  return screenVectorToZoneLocal(labelPointOnScreen, rotation);
}

function seatNumberLabel(seatNumber) {
  const value = String(seatNumber || '');
  const match = value.match(/(\d+)$/);
  return match ? match[1] : value || '?';
}

function getNormalizedRotation(rotation) {
  return ((Number(rotation || 0) % 360) + 360) % 360;
}

function isSidewaysRotation(rotation) {
  const normalizedRotation = getNormalizedRotation(rotation);
  return Math.abs(normalizedRotation - 90) < 8 || Math.abs(normalizedRotation - 270) < 8;
}

function layoutSeatPoint(seat) {
  return {
    x: Number(seat.localX ?? seat.x ?? 0) * DESIGN_WIDTH,
    y: Number(seat.localY ?? seat.y ?? 0) * DESIGN_HEIGHT,
  };
}

function hasStoredLocalSeatPosition(seat) {
  return Number.isFinite(Number(seat?.localX)) && Number.isFinite(Number(seat?.localY));
}

function rowNameFrom(index, startLabel) {
  const base = (startLabel || 'A').trim().toUpperCase().charCodeAt(0) || 65;
  return String.fromCharCode(base + index);
}

function getRenderableSeats(zone) {
  const sourceSeats = Array.isArray(zone.seats) ? zone.seats : [];
  if (sourceSeats.length && sourceSeats.every(hasStoredLocalSeatPosition)) {
    return sourceSeats.map((seat, index) => {
      const seatsPerRow = Math.max(Number(zone.seatsPerRow || 1), 1);
      const inferredRowIndex = Math.floor(index / seatsPerRow);
      const rowNameFromSeatNumber = String(seat.seatNumber || '').replace(/\d+$/, '');
      const rowName = seat.rowName || rowNameFromSeatNumber || rowNameFrom(inferredRowIndex, zone.rowLabel);
      return {
        ...seat,
        id: seat.id || `${zone.id}-${index}`,
        rowName,
        seatNumber: seat.seatNumber || `${rowName}${(index % seatsPerRow) + 1}`,
        localX: Number(seat.localX),
        localY: Number(seat.localY),
      };
    });
  }

  const rows = Math.max(Number(zone.rows || 1), 1);
  const seatsPerRow = Math.max(Number(zone.seatsPerRow || sourceSeats.length || 1), 1);
  const seatSpacing = Number(zone.geometry?.seatSpacing ?? zone.seatSpacing ?? 30);
  const rowGap = Number(zone.geometry?.rowGap ?? zone.rowGap ?? 34);
  const startX = -((seatsPerRow - 1) * seatSpacing) / 2;
  const startY = -((rows - 1) * rowGap) / 2;
  const generatedSeats = [];

  for (let row = 0; row < rows; row += 1) {
    const rowName = rowNameFrom(row, zone.rowLabel);
    for (let col = 0; col < seatsPerRow; col += 1) {
      generatedSeats.push({
        id: `${zone.id}-${row}-${col}`,
        rowName,
        seatNumber: `${rowName}${col + 1}`,
        x: startX + col * seatSpacing,
        y: startY + row * rowGap,
        status: 'AVAILABLE',
      });
    }
  }

  return generatedSeats.map((generatedSeat, index) => {
    const originalSeat = sourceSeats[index] || {};
    return {
      ...originalSeat,
      ...generatedSeat,
      id: originalSeat.id || generatedSeat.id,
      rowName: originalSeat.rowName || generatedSeat.rowName,
      seatNumber: originalSeat.seatNumber || generatedSeat.seatNumber,
      localX: generatedSeat.x / DESIGN_WIDTH,
      localY: generatedSeat.y / DESIGN_HEIGHT,
    };
  });
}

function getZoneBounds(zone) {
  const points = getRenderableSeats(zone).map(layoutSeatPoint);
  if (!points.length) {
    return { minX: -90, maxX: 90, minY: -60, maxY: 60, width: 180, height: 120 };
  }

  const minX = Math.min(...points.map((point) => point.x)) - ZONE_INSET_LEFT;
  const maxX = Math.max(...points.map((point) => point.x)) + ZONE_INSET_RIGHT;
  const minY = Math.min(...points.map((point) => point.y)) - ZONE_INSET_TOP;
  const maxY = Math.max(...points.map((point) => point.y)) + ZONE_INSET_BOTTOM;
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function toAbsoluteRatio(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function getAbsoluteRatioCenter(entity) {
  const absoluteX = entity?.absoluteCenter?.x;
  const absoluteY = entity?.absoluteCenter?.y;
  if (Number.isFinite(Number(absoluteX)) && Number.isFinite(Number(absoluteY))) {
    return {
      x: toAbsoluteRatio(absoluteX),
      y: toAbsoluteRatio(absoluteY),
    };
  }

  const directX = entity?.x;
  const directY = entity?.y;
  if (Number.isFinite(Number(directX)) && Number.isFinite(Number(directY))) {
    return {
      x: toAbsoluteRatio(directX),
      y: toAbsoluteRatio(directY),
    };
  }

  const centeredX = entity?.pos_x ?? entity?.posX ?? entity?.center?.x;
  const centeredY = entity?.pos_y ?? entity?.posY ?? entity?.center?.y;
  return {
    x: 0.5 + Number(centeredX || 0),
    y: 0.5 + Number(centeredY || 0),
  };
}

function hasExplicitRatioCenter(entity = {}) {
  const absoluteX = entity?.absoluteCenter?.x;
  const absoluteY = entity?.absoluteCenter?.y;
  if (Number.isFinite(Number(absoluteX)) && Number.isFinite(Number(absoluteY))) {
    return true;
  }

  const directX = entity?.x;
  const directY = entity?.y;
  if (Number.isFinite(Number(directX)) && Number.isFinite(Number(directY))) {
    return true;
  }

  const centeredX = entity?.pos_x ?? entity?.posX ?? entity?.center?.x;
  const centeredY = entity?.pos_y ?? entity?.posY ?? entity?.center?.y;
  return Number.isFinite(Number(centeredX)) && Number.isFinite(Number(centeredY));
}

function getZoneCenter(zone) {
  const center = getAbsoluteRatioCenter(zone);
  return {
    x: center.x * DESIGN_WIDTH,
    y: center.y * DESIGN_HEIGHT,
  };
}

function getElementCenter(element) {
  const center = getAbsoluteRatioCenter(element);
  return {
    x: center.x * DESIGN_WIDTH,
    y: center.y * DESIGN_HEIGHT,
  };
}

function getRowLabels(zone, rotation = 0) {
  const renderableSeats = getRenderableSeats(zone);

  if (isSidewaysRotation(rotation)) {
    const seatOneAnchors = renderableSeats
      .filter((seat) => Number(seatNumberLabel(seat.seatNumber)) === 1)
      .map((seat) => {
        const point = layoutSeatPoint(seat);
        const screenPoint = rotatePoint(point, rotation);
        return {
          rowName: seat.rowName,
          point,
          screenPoint,
        };
      })
      .sort((first, second) => first.screenPoint.x - second.screenPoint.x);

    if (seatOneAnchors.length) {
      return seatOneAnchors.map((anchor, index) => {
        const nextSeatInRow = renderableSeats.find((seat) => {
          const rowName = seat.rowName || String(seat.seatNumber || '').replace(/\d+$/, '');
          return rowName === anchor.rowName && Number(seatNumberLabel(seat.seatNumber)) === 2;
        });
        const nextSeatScreenPoint = nextSeatInRow
          ? rotatePoint(layoutSeatPoint(nextSeatInRow), rotation)
          : null;
        const directionToNextSeat = nextSeatScreenPoint
          ? Math.sign(nextSeatScreenPoint.y - anchor.screenPoint.y)
          : -1;
        const labelDirection = directionToNextSeat === 0 ? -1 : -directionToNextSeat;
        const labelPoint = screenVectorToZoneLocal(
          {
            x: anchor.screenPoint.x,
            y: anchor.screenPoint.y + labelDirection * ROW_LABEL_SCREEN_GAP,
          },
          rotation,
        );

        return {
          rowName: anchor.rowName || rowNameFrom(index, zone.rowLabel),
          labelX: labelPoint.x,
          labelY: labelPoint.y,
        };
      });
    }
  }

  const rows = new Map();
  renderableSeats.forEach((seat) => {
    const rowName = seat.rowName || String(seat.seatNumber || '').replace(/\d+$/, '') || '';
    if (!rowName) return;
    const point = layoutSeatPoint(seat);
    const current = rows.get(rowName);
    const seatLabelNumber = Number(seatNumberLabel(seat.seatNumber));
    const isSeatOne = seatLabelNumber === 1;
    if (!current || (isSeatOne && !current.isSeatOne) || (!current.isSeatOne && point.x < current.x)) {
      rows.set(rowName, { rowName, isSeatOne, ...point });
    }
  });
  return Array.from(rows.values()).sort((a, b) => a.y - b.y);
}

function expandBounds(bounds, nextBounds) {
  return {
    minX: Math.min(bounds.minX, nextBounds.minX),
    maxX: Math.max(bounds.maxX, nextBounds.maxX),
    minY: Math.min(bounds.minY, nextBounds.minY),
    maxY: Math.max(bounds.maxY, nextBounds.maxY),
  };
}

function isStageElement(element) {
  const type = String(element?.type || '').toLowerCase();
  const label = String(element?.label || '').toLowerCase();
  return type === 'stage' || label.includes('stage');
}

function getObjectSize(object, fallback = { width: 160, height: 80 }) {
  if (object?.type || object?.label) {
    return {
      width: Number(object.width || fallback.width),
      height: Number(object.height || fallback.height),
    };
  }

  const bounds = getZoneBounds(object);
  return {
    width: bounds.width,
    height: bounds.height,
  };
}

function getObjectCenter(object) {
  return object?.type || object?.label ? getElementCenter(object) : getZoneCenter(object);
}

function getZoneSide(zone, stageRef) {
  const zoneCenter = getZoneCenter(zone);
  const stageCenter = getElementCenter(stageRef);
  const dx = zoneCenter.x - stageCenter.x;
  const dy = zoneCenter.y - stageCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }

  return dy < 0 ? 'top' : 'bottom';
}

function getZoneGroupAxis(zones) {
  if (zones.length < 2) return 'single';

  const centers = zones.map(getZoneCenter);
  const minX = Math.min(...centers.map((center) => center.x));
  const maxX = Math.max(...centers.map((center) => center.x));
  const minY = Math.min(...centers.map((center) => center.y));
  const maxY = Math.max(...centers.map((center) => center.y));

  return maxY - minY > maxX - minX ? 'vertical' : 'horizontal';
}

function getStackSize(zones, axis) {
  return zones.reduce((total, zone, index) => {
    const size = getObjectSize(zone);
    const axisSize = axis === 'vertical' ? size.height : size.width;
    return total + axisSize + (index > 0 ? ZONE_TO_ZONE_GAP : 0);
  }, 0);
}

function getAverageCenter(zones) {
  const centers = zones.map(getZoneCenter);
  return {
    x: centers.reduce((total, center) => total + center.x, 0) / Math.max(centers.length, 1),
    y: centers.reduce((total, center) => total + center.y, 0) / Math.max(centers.length, 1),
  };
}

function getNormalizedPosition(object, stageRef, normalizedPositionLookup) {
  if (!stageRef || !normalizedPositionLookup) {
    return getObjectCenter(object);
  }

  return normalizedPositionLookup.get(object.id || object) || getObjectCenter(object);
}

function buildNormalizedZonePositions(zones, stageRef) {
  const lookup = new Map();
  if (!stageRef) return lookup;

  const stageCenter = getElementCenter(stageRef);
  const stageSize = getObjectSize(stageRef, { width: 220, height: 64 });
  const groupedZones = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };

  zones.forEach((zone) => {
    groupedZones[getZoneSide(zone, stageRef)].push(zone);
  });

  Object.entries(groupedZones).forEach(([side, sideZones]) => {
    const designAxis = getZoneGroupAxis(sideZones);
    const stackAxis = designAxis === 'single'
      ? (side === 'left' || side === 'right' ? 'vertical' : 'horizontal')
      : designAxis;
    const orderedZones = [...sideZones].sort((a, b) => {
      const centerA = getZoneCenter(a);
      const centerB = getZoneCenter(b);
      return stackAxis === 'vertical' ? centerA.y - centerB.y : centerA.x - centerB.x;
    });
    const averageCenter = getAverageCenter(orderedZones);

    if (stackAxis === 'vertical') {
      const totalHeight = getStackSize(orderedZones, 'vertical');
      let yCursor = stageCenter.y - totalHeight / 2;
      let x = averageCenter.x;

      if (side === 'top') {
        yCursor = stageCenter.y - stageSize.height / 2 - STAGE_TO_ZONE_GAP - totalHeight;
        x = averageCenter.x;
      }

      if (side === 'bottom') {
        yCursor = stageCenter.y + stageSize.height / 2 + STAGE_TO_ZONE_GAP;
        x = averageCenter.x;
      }

      if (side === 'left') {
        const widestZone = Math.max(...orderedZones.map((zone) => getObjectSize(zone).width));
        x = stageCenter.x - stageSize.width / 2 - STAGE_TO_ZONE_GAP - widestZone / 2;
      }

      if (side === 'right') {
        const widestZone = Math.max(...orderedZones.map((zone) => getObjectSize(zone).width));
        x = stageCenter.x + stageSize.width / 2 + STAGE_TO_ZONE_GAP + widestZone / 2;
      }

      orderedZones.forEach((zone) => {
        const zoneSize = getObjectSize(zone);
        lookup.set(zone.id || zone, {
          x,
          y: yCursor + zoneSize.height / 2,
        });
        yCursor += zoneSize.height + ZONE_TO_ZONE_GAP;
      });
      return;
    }

    const totalWidth = getStackSize(orderedZones, 'horizontal');
    let xCursor = stageCenter.x - totalWidth / 2;
    let y = averageCenter.y;

    if (side === 'top') {
      y = stageCenter.y - stageSize.height / 2 - STAGE_TO_ZONE_GAP - Math.max(...orderedZones.map((zone) => getObjectSize(zone).height)) / 2;
    }

    if (side === 'bottom') {
      y = stageCenter.y + stageSize.height / 2 + STAGE_TO_ZONE_GAP + Math.max(...orderedZones.map((zone) => getObjectSize(zone).height)) / 2;
    }

    if (side === 'left') {
      xCursor = stageCenter.x - stageSize.width / 2 - STAGE_TO_ZONE_GAP - totalWidth;
      y = averageCenter.y;
    }

    if (side === 'right') {
      xCursor = stageCenter.x + stageSize.width / 2 + STAGE_TO_ZONE_GAP;
      y = averageCenter.y;
    }

    orderedZones.forEach((zone) => {
      const zoneSize = getObjectSize(zone);
      lookup.set(zone.id || zone, {
        x: xCursor + zoneSize.width / 2,
        y,
      });
      xCursor += zoneSize.width + ZONE_TO_ZONE_GAP;
    });
  });

  return lookup;
}

function getLayoutBounds(zones, staticElements, stageRef, normalizedPositionLookup) {
  let bounds = {
    minX: DESIGN_WIDTH * 0.35,
    maxX: DESIGN_WIDTH * 0.65,
    minY: DESIGN_HEIGHT * 0.35,
    maxY: DESIGN_HEIGHT * 0.65,
  };

  zones.forEach((zone) => {
    const { x: centerX, y: centerY } = getNormalizedPosition(zone, stageRef, normalizedPositionLookup);
    const zoneBounds = getZoneBounds(zone);
    bounds = expandBounds(bounds, {
      minX: centerX + zoneBounds.minX,
      maxX: centerX + zoneBounds.maxX,
      minY: centerY + zoneBounds.minY,
      maxY: centerY + zoneBounds.maxY,
    });
  });

  staticElements.forEach((element) => {
    const { x: centerX, y: centerY } = getElementCenter(element);
    const width = Number(element.width || 160);
    const height = Number(element.height || 60);
    bounds = expandBounds(bounds, {
      minX: centerX - width / 2,
      maxX: centerX + width / 2,
      minY: centerY - height / 2,
      maxY: centerY + height / 2,
    });
  });

  return bounds;
}

export default function CustomerSeatMapCanvas({
  layout,
  liveSeats = [],
  selectedSeats = [],
  onToggleSeat = () => {},
}) {
  const containerRef = useRef(null);
  const panStartRef = useRef(null);
  const zoomRef = useRef(0.9);
  const panRef = useRef({ x: 20, y: 20 });
  const zoomTargetRef = useRef({ zoom: 0.9, pan: { x: 20, y: 20 } });
  const zoomAnimationRef = useRef(null);
  const panMovedRef = useRef(false);
  const suppressSeatClickRef = useRef(false);
  const [stageWidth, setStageWidth] = useState(900);
  const [zoom, setZoom] = useState(0.9);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState('');
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [zoneTooltip, setZoneTooltip] = useState(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(Math.max(320, entry.contentRect.width));
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => () => {
    if (zoomAnimationRef.current) {
      window.cancelAnimationFrame(zoomAnimationRef.current);
    }
  }, []);

  const stageHeight = Math.min(720, Math.max(460, stageWidth * 0.68));
  const baseScale = stageWidth / DESIGN_WIDTH;

  const selectedIds = useMemo(
    () => new Set(selectedSeats.map((item) => String(item.seat.id))),
    [selectedSeats],
  );

  const liveLookup = useMemo(() => {
    const byId = new Map();
    const byLabel = new Map();
    liveSeats.forEach((seat) => {
      byId.set(String(seat.id), seat);
      byLabel.set(liveSeatKey(seat.venueZone?.name || seat.zoneName || seat.zone, seat.seatNumber), seat);
    });
    return { byId, byLabel };
  }, [liveSeats]);

  const zones = Array.isArray(layout?.zones)
    ? layout.zones
    : Array.isArray(layout?.venue_zones)
      ? layout.venue_zones
      : [];
  const staticElements = Array.isArray(layout?.staticElements)
    ? layout.staticElements
    : Array.isArray(layout?.static_elements)
      ? layout.static_elements
      : [];
  const stageRef = useMemo(() => staticElements.find(isStageElement), [staticElements]);
  const shouldPreserveSavedPositions = useMemo(
    () => Boolean(layout?.coordinateSystem) || zones.some(hasExplicitRatioCenter),
    [layout?.coordinateSystem, zones],
  );
  const normalizedPositionLookup = useMemo(
    () => (shouldPreserveSavedPositions ? new Map() : buildNormalizedZonePositions(zones, stageRef)),
    [shouldPreserveSavedPositions, stageRef, zones],
  );

  useEffect(() => {
    if (!zones.length && !staticElements.length) return;

    const bounds = getLayoutBounds(zones, staticElements, stageRef, normalizedPositionLookup);
    const padding = 90;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const fitScale = Math.min(
      (stageWidth - padding) / contentWidth,
      (stageHeight - padding) / contentHeight,
      1.35,
    );
    const nextZoom = Math.max(0.45, fitScale / baseScale);
    const finalScale = baseScale * nextZoom;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const nextPan = {
      x: stageWidth / 2 - centerX * finalScale,
      y: stageHeight / 2 - centerY * finalScale,
    };

    setZoom(nextZoom);
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    zoomTargetRef.current = { zoom: nextZoom, pan: nextPan };
    setPan(nextPan);
  }, [baseScale, stageHeight, stageRef, stageWidth, zones, staticElements, normalizedPositionLookup]);

  const animateZoomToTarget = () => {
    const target = zoomTargetRef.current;
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    const nextZoom = currentZoom + (target.zoom - currentZoom) * ZOOM_LERP;
    const nextPan = {
      x: currentPan.x + (target.pan.x - currentPan.x) * ZOOM_LERP,
      y: currentPan.y + (target.pan.y - currentPan.y) * ZOOM_LERP,
    };
    const isSettled = Math.abs(nextZoom - target.zoom) < 0.001
      && Math.abs(nextPan.x - target.pan.x) < 0.5
      && Math.abs(nextPan.y - target.pan.y) < 0.5;

    const settledZoom = isSettled ? target.zoom : nextZoom;
    const settledPan = isSettled ? target.pan : nextPan;
    zoomRef.current = settledZoom;
    panRef.current = settledPan;
    setZoom(settledZoom);
    setPan(settledPan);

    if (isSettled) {
      zoomAnimationRef.current = null;
      return;
    }

    zoomAnimationRef.current = window.requestAnimationFrame(animateZoomToTarget);
  };

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const currentTarget = zoomTargetRef.current || { zoom: zoomRef.current, pan: panRef.current };
    const oldZoom = currentTarget.zoom;
    const oldScale = baseScale * oldZoom;
    const pointerContentPoint = {
      x: (pointer.x - currentTarget.pan.x) / oldScale,
      y: (pointer.y - currentTarget.pan.y) / oldScale,
    };
    const zoomFactor = Math.exp(-event.evt.deltaY / ZOOM_DELTA_NORMALIZER);
    const nextZoom = Math.min(Math.max(oldZoom * zoomFactor, MIN_ZOOM), MAX_ZOOM);
    const nextScale = baseScale * nextZoom;
    const nextPan = {
      x: pointer.x - pointerContentPoint.x * nextScale,
      y: pointer.y - pointerContentPoint.y * nextScale,
    };

    zoomTargetRef.current = { zoom: nextZoom, pan: nextPan };
    if (!zoomAnimationRef.current) {
      zoomAnimationRef.current = window.requestAnimationFrame(animateZoomToTarget);
    }
  };

  const applyZoomPercent = (value) => {
    const numeric = Number(String(value).replace('%', '').trim());
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setIsEditingZoom(false);
      return;
    }

    const nextZoom = Math.min(Math.max(numeric / 100, MIN_ZOOM), MAX_ZOOM);
    const oldScale = baseScale * zoomRef.current;
    const nextScale = baseScale * nextZoom;
    const viewportCenter = {
      x: stageWidth / 2,
      y: stageHeight / 2,
    };
    const contentCenter = {
      x: (viewportCenter.x - panRef.current.x) / oldScale,
      y: (viewportCenter.y - panRef.current.y) / oldScale,
    };
    const nextPan = {
      x: viewportCenter.x - contentCenter.x * nextScale,
      y: viewportCenter.y - contentCenter.y * nextScale,
    };

    if (zoomAnimationRef.current) {
      window.cancelAnimationFrame(zoomAnimationRef.current);
      zoomAnimationRef.current = null;
    }

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    zoomTargetRef.current = { zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
    setIsEditingZoom(false);
  };

  const startEditingZoom = () => {
    setZoomInput(String(Math.round(zoomRef.current * 100)));
    setIsEditingZoom(true);
  };

  const handleZoomInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      applyZoomPercent(zoomInput);
      return;
    }

    if (event.key === 'Escape') {
      setIsEditingZoom(false);
    }
  };

  const setCanvasCursor = (cursor) => {
    const stage = containerRef.current?.querySelector('canvas');
    if (stage) stage.style.cursor = cursor;
  };

  const handleMouseDown = (event) => {
    if (event.evt.button != null && event.evt.button !== 0) return;
    setZoneTooltip(null);
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    if (zoomAnimationRef.current) {
      window.cancelAnimationFrame(zoomAnimationRef.current);
      zoomAnimationRef.current = null;
    }

    panMovedRef.current = false;
    panStartRef.current = {
      pointer,
      pan: panRef.current,
    };
    setCanvasCursor('grabbing');
  };

  const handleMouseMove = (event) => {
    if (panStartRef.current) {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const dx = pointer.x - panStartRef.current.pointer.x;
      const dy = pointer.y - panStartRef.current.pointer.y;
      const nextPan = {
        x: panStartRef.current.pan.x + dx,
        y: panStartRef.current.pan.y + dy,
      };
      if (Math.hypot(dx, dy) > 4) {
        panMovedRef.current = true;
        suppressSeatClickRef.current = true;
      }
      panRef.current = nextPan;
      zoomTargetRef.current = { zoom: zoomRef.current, pan: nextPan };
      setPan(nextPan);
      setCanvasCursor('grabbing');
      return;
    }
    setCanvasCursor('grab');
  };

  const handleMouseUp = () => {
    const moved = panMovedRef.current;
    panStartRef.current = null;
    panMovedRef.current = false;
    setCanvasCursor('grab');
    if (moved) {
      window.setTimeout(() => {
        suppressSeatClickRef.current = false;
      }, 120);
    }
  };

  const handleSeatToggle = (seat, zone, tier) => {
    if (suppressSeatClickRef.current) {
      suppressSeatClickRef.current = false;
      return;
    }
    onToggleSeat(seat, zone, tier);
  };

  const updateZoneTooltip = (event, zone, zonePrice) => {
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;

    const text = `${zone.name || 'Untitled Zone'}  $${zonePrice.toLocaleString()}`;
    const width = clamp(text.length * 7.5 + 28, 150, 320);
    setZoneTooltip({
      text,
      width,
      x: clamp(pointer.x + 16, 8, stageWidth - width - 8),
      y: clamp(pointer.y + 16, 8, stageHeight - ZONE_TOOLTIP_HEIGHT - 8),
    });
  };

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs font-bold text-slate-300">
        <span>Scroll to zoom - drag empty space to pan</span>
        {isEditingZoom ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={zoomInput}
              onChange={(event) => setZoomInput(event.target.value)}
              onBlur={() => applyZoomPercent(zoomInput)}
              onKeyDown={handleZoomInputKeyDown}
              className="h-6 w-14 rounded-md border border-violet-400 bg-slate-900 px-2 text-right text-xs font-bold text-white outline-none focus:ring-2 focus:ring-violet-500"
              inputMode="numeric"
            />
            <span>%</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditingZoom}
            className="rounded-md px-2 py-1 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
            title="Click to set zoom percentage"
          >
            {Math.round(zoom * 100)}%
          </button>
        )}
      </div>
      <Stage
        width={stageWidth}
        height={stageHeight}
        x={0}
        y={0}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setZoneTooltip(null);
        }}
      >
        <Layer x={pan.x} y={pan.y} scaleX={baseScale * zoom} scaleY={baseScale * zoom}>
          <Rect name="seat-map-background" width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="#020617" />
          <Line points={[DESIGN_WIDTH / 2, 0, DESIGN_WIDTH / 2, DESIGN_HEIGHT]} stroke="#1e293b" dash={[8, 10]} />
          <Line points={[0, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT / 2]} stroke="#1e293b" dash={[8, 10]} />

          {zones.map((zone) => {
            const seatBounds = getZoneBounds(zone);
            const zonePrice = Number(zone.price || 0);
            const renderableSeats = getRenderableSeats(zone);
            const zoneRotation = Number(zone.rotation || 0);
            const rowLabels = getRowLabels(zone, zoneRotation);
            const bounds = seatBounds;
            const zoneCenter = getNormalizedPosition(zone, stageRef, normalizedPositionLookup);

            return (
              <Group
                key={zone.id}
                x={zoneCenter.x}
                y={zoneCenter.y}
                rotation={zoneRotation}
                onMouseEnter={(event) => updateZoneTooltip(event, zone, zonePrice)}
                onMouseMove={(event) => updateZoneTooltip(event, zone, zonePrice)}
                onMouseLeave={() => setZoneTooltip(null)}
              >
                <Rect
                  name="seat-map-pan-surface"
                  x={bounds.minX}
                  y={bounds.minY}
                  width={bounds.width}
                  height={bounds.height}
                  cornerRadius={22}
                  fill="#ffffff"
                  opacity={0.06}
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  dash={[8, 8]}
                />

                {renderableSeats.map((layoutSeat) => {
                  const liveSeat = liveLookup.byId.get(String(layoutSeat.id))
                    || liveLookup.byLabel.get(liveSeatKey(zone.name, layoutSeat.seatNumber))
                    || layoutSeat;
                  const status = normalizeStatus(liveSeat.status || layoutSeat.status);
                  const isUnavailable = ['SOLD', 'BOOKED', 'LOCKED', 'HELD', 'RESERVED'].includes(status);
                  const seatId = liveSeat.id || layoutSeat.id || `${zone.id}-${layoutSeat.seatNumber}`;
                  const isSelected = selectedIds.has(String(seatId));
                  const colors = isSelected ? statusColor.SELECTED : statusColor[status] || statusColor.AVAILABLE;
                  const point = layoutSeatPoint(layoutSeat);
                  const seat = {
                    ...layoutSeat,
                    ...liveSeat,
                    id: seatId,
                    seatNumber: liveSeat.seatNumber || layoutSeat.seatNumber,
                    rowName: liveSeat.rowName || layoutSeat.rowName,
                    price: getSeatPrice(liveSeat, zone),
                  };

                  return (
                    <Group
                      key={`${zone.id}-${layoutSeat.id || layoutSeat.seatNumber}`}
                      x={point.x}
                      y={point.y}
                      opacity={isUnavailable ? 0.68 : 1}
                      onClick={() => !isUnavailable && handleSeatToggle(seat, zone, { tierName: zone.name, price: getSeatPrice(liveSeat, zone) })}
                      onTap={() => !isUnavailable && handleSeatToggle(seat, zone, { tierName: zone.name, price: getSeatPrice(liveSeat, zone) })}
                    >
                      <Rect
                        x={-SEAT_SIZE / 2}
                        y={-SEAT_SIZE / 2}
                        width={SEAT_SIZE}
                        height={SEAT_SIZE}
                        cornerRadius={8}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1}
                        shadowColor={isSelected ? '#7c3aed' : '#000000'}
                        shadowBlur={isSelected ? 10 : 0}
                        shadowOpacity={isSelected ? 0.45 : 0}
                      />
                      <Group rotation={-zoneRotation}>
                        <Text
                          x={-SEAT_SIZE / 2}
                          y={-6}
                          width={SEAT_SIZE}
                          align="center"
                          text={seatNumberLabel(seat.seatNumber)}
                          fill={colors.text}
                          fontStyle="bold"
                          fontSize={10}
                        />
                      </Group>
                    </Group>
                  );
                })}

                {rowLabels.map((row) => {
                  const rowLabelPosition = clampScreenAlignedPointInsideBounds(
                    getRowLabelPosition(row, zoneRotation),
                    seatBounds,
                    zoneRotation,
                    24,
                    16,
                  );

                  return (
                    <Group
                      key={`${zone.id}-row-${row.rowName}`}
                      x={rowLabelPosition.x}
                      y={rowLabelPosition.y}
                      rotation={-zoneRotation}
                      listening={false}
                    >
                      <Text
                        x={-12}
                        y={-8}
                        width={24}
                        align="center"
                        text={row.rowName}
                        fill="#cbd5e1"
                        fontStyle="bold"
                        fontSize={13}
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}

          {staticElements.map((element) => {
            const center = getElementCenter(element);
            const x = center.x;
            const y = center.y;
            const width = Number(element.width || 160);
            const height = Number(element.height || 60);
            const elementRotation = Number(element.rotation || 0);
            return (
              <Group key={element.id || `${element.label}-${x}-${y}`} x={x} y={y} rotation={elementRotation}>
                <Rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  cornerRadius={20}
                  fill={element.type === 'field' ? '#14532d' : element.type === 'exit' ? '#7f1d1d' : '#312e81'}
                  stroke={element.type === 'field' ? '#22c55e' : element.type === 'exit' ? '#fca5a5' : '#a78bfa'}
                  strokeWidth={2}
                  opacity={0.95}
                />
                <Group rotation={-elementRotation}>
                  <Text
                    x={-width / 2}
                    y={-8}
                    width={width}
                    align="center"
                    text={element.label || element.type || 'ANCHOR'}
                    fill="#fff"
                    fontStyle="bold"
                    fontSize={16}
                  />
                </Group>
              </Group>
            );
          })}
        </Layer>

        {zoneTooltip ? (
          <Layer listening={false}>
            <Group x={zoneTooltip.x} y={zoneTooltip.y}>
              <Rect
                width={zoneTooltip.width}
                height={ZONE_TOOLTIP_HEIGHT}
                cornerRadius={12}
                fill="#1e1b4b"
                opacity={0.94}
                stroke="#a78bfa"
                strokeWidth={1}
                shadowColor="#000000"
                shadowBlur={14}
                shadowOpacity={0.28}
              />
              <Text
                x={14}
                y={10}
                width={zoneTooltip.width - 28}
                align="center"
                text={zoneTooltip.text}
                fill="#ede9fe"
                fontStyle="bold"
                fontSize={12}
                ellipsis
              />
            </Group>
          </Layer>
        ) : null}
      </Stage>
    </div>
  );
}
