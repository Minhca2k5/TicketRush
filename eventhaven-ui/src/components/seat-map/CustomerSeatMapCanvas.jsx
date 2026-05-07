import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';

const DESIGN_WIDTH = 980;
const DESIGN_HEIGHT = 760;
const SEAT_SIZE = 24;
const ZONE_INSET_X = 86;
const ZONE_INSET_TOP = 62;
const ZONE_INSET_BOTTOM = 42;
const STAGE_TO_ZONE_GAP = 100;
const ZONE_TO_ZONE_GAP = 60;
const ZONE_LABEL_HEIGHT = 34;
const ZONE_LABEL_SAFE_PADDING = 8;
const ZONE_TITLE_SPACE = 18;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_DELTA_NORMALIZER = 1400;
const ZOOM_LERP = 0.22;

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
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((corner) => rotatePoint(corner, rotation));

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function getSmartZoneLabelPosition(bounds, rotation, labelHeight = ZONE_LABEL_HEIGHT) {
  const clientRect = getRotatedZoneClientRect(bounds, rotation);
  const screenTopCenter = {
    x: clientRect.x + clientRect.width / 2,
    y: clientRect.y + ZONE_LABEL_SAFE_PADDING + labelHeight / 2,
  };

  return screenVectorToZoneLocal(screenTopCenter, rotation);
}

function getScreenTopLocalSide(rotation) {
  const localTopVector = screenVectorToZoneLocal({ x: 0, y: -1 }, rotation);
  if (Math.abs(localTopVector.x) > Math.abs(localTopVector.y)) {
    return localTopVector.x < 0 ? 'minX' : 'maxX';
  }
  return localTopVector.y < 0 ? 'minY' : 'maxY';
}

function expandBoundsForZoneTitle(bounds, rotation) {
  const nextBounds = { ...bounds };
  const side = getScreenTopLocalSide(rotation);
  const titleSpace = ZONE_TITLE_SPACE + ZONE_LABEL_SAFE_PADDING + ZONE_LABEL_HEIGHT;

  if (side === 'minX') nextBounds.minX -= titleSpace;
  if (side === 'maxX') nextBounds.maxX += titleSpace;
  if (side === 'minY') nextBounds.minY -= titleSpace;
  if (side === 'maxY') nextBounds.maxY += titleSpace;

  return {
    ...nextBounds,
    width: nextBounds.maxX - nextBounds.minX,
    height: nextBounds.maxY - nextBounds.minY,
  };
}

function seatNumberLabel(seatNumber) {
  const value = String(seatNumber || '');
  const match = value.match(/(\d+)$/);
  return match ? match[1] : value || '?';
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
      const rowName = seat.rowName || String(seat.seatNumber || '').replace(/\d+$/, '') || rowNameFrom(0, zone.rowLabel);
      return {
        ...seat,
        id: seat.id || `${zone.id}-${index}`,
        rowName,
        seatNumber: seat.seatNumber || `${rowName}${index + 1}`,
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

  const minX = Math.min(...points.map((point) => point.x)) - ZONE_INSET_X;
  const maxX = Math.max(...points.map((point) => point.x)) + 42;
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

function getRowLabels(zone) {
  const rows = new Map();
  getRenderableSeats(zone).forEach((seat) => {
    const rowName = seat.rowName || String(seat.seatNumber || '').replace(/\d+$/, '') || '';
    if (!rowName) return;
    const point = layoutSeatPoint(seat);
    const current = rows.get(rowName);
    if (!current || point.x < current.x) rows.set(rowName, { rowName, ...point });
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

  const bounds = expandBoundsForZoneTitle(getZoneBounds(object), Number(object.rotation || 0));
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
    const zoneBounds = expandBoundsForZoneTitle(getZoneBounds(zone), Number(zone.rotation || 0));
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
  const [pan, setPan] = useState({ x: 20, y: 20 });

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
  const normalizedPositionLookup = useMemo(
    () => buildNormalizedZonePositions(zones, stageRef),
    [stageRef, zones],
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

  const setCanvasCursor = (cursor) => {
    const stage = containerRef.current?.querySelector('canvas');
    if (stage) stage.style.cursor = cursor;
  };

  const handleMouseDown = (event) => {
    if (event.evt.button != null && event.evt.button !== 0) return;
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

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs font-bold text-slate-300">
        <span>Scroll to zoom - drag empty space to pan</span>
        <span>{Math.round(zoom * 100)}%</span>
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
        onMouseLeave={handleMouseUp}
      >
        <Layer x={pan.x} y={pan.y} scaleX={baseScale * zoom} scaleY={baseScale * zoom}>
          <Rect name="seat-map-background" width={DESIGN_WIDTH} height={DESIGN_HEIGHT} fill="#020617" />
          <Line points={[DESIGN_WIDTH / 2, 0, DESIGN_WIDTH / 2, DESIGN_HEIGHT]} stroke="#1e293b" dash={[8, 10]} />
          <Line points={[0, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT / 2]} stroke="#1e293b" dash={[8, 10]} />

          {zones.map((zone) => {
            const seatBounds = getZoneBounds(zone);
            const rowLabels = getRowLabels(zone);
            const zonePrice = Number(zone.price || 0);
            const renderableSeats = getRenderableSeats(zone);
            const zoneRotation = Number(zone.rotation || 0);
            const bounds = expandBoundsForZoneTitle(seatBounds, zoneRotation);
            const labelClientRect = getRotatedZoneClientRect(bounds, zoneRotation);
            const labelWidth = Math.max(180, Math.min(labelClientRect.width - 48, 340));
            const labelPosition = getSmartZoneLabelPosition(bounds, zoneRotation);
            const zoneCenter = getNormalizedPosition(zone, stageRef, normalizedPositionLookup);

            return (
              <Group
                key={zone.id}
                x={zoneCenter.x}
                y={zoneCenter.y}
                rotation={zoneRotation}
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
                <Group x={labelPosition.x} y={labelPosition.y} rotation={-zoneRotation} listening={false}>
                  <Rect
                    x={-labelWidth / 2}
                    y={-ZONE_LABEL_HEIGHT / 2}
                    width={labelWidth}
                    height={ZONE_LABEL_HEIGHT}
                    cornerRadius={12}
                    fill="#1e1b4b"
                    opacity={0.82}
                    stroke="#a78bfa"
                    strokeWidth={1}
                  />
                  <Text
                    x={-labelWidth / 2 + 12}
                    y={-8}
                    width={labelWidth - 24}
                    align="center"
                    text={`${zone.name}  $${zonePrice.toLocaleString()}`}
                    fill="#ede9fe"
                    fontStyle="bold"
                    fontSize={12}
                    ellipsis
                  />
                </Group>

                {rowLabels.map((row) => (
                  <Group
                    key={`${zone.id}-row-${row.rowName}`}
                    x={bounds.minX + 34}
                    y={row.y}
                    rotation={-zoneRotation}
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
                ))}

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
      </Stage>
    </div>
  );
}
