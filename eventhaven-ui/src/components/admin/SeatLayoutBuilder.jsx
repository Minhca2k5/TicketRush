import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { Copy, LocateFixed, MousePointer2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';

const DESIGN_WIDTH = 980;
const DESIGN_HEIGHT = 760;
const SEAT_RADIUS = 6;
const ZONE_LABEL_HEIGHT = 26;
const ZONE_LABEL_SAFE_PADDING = 8;
const ZONE_TITLE_SPACE = 18;

const staticElementOptions = [
  { type: 'stage', label: 'STAGE', width: 220, height: 64, fill: '#312e81', stroke: '#a78bfa' },
  { type: 'field', label: 'FIELD', width: 260, height: 120, fill: '#14532d', stroke: '#22c55e' },
  { type: 'exit', label: 'EXIT', width: 92, height: 44, fill: '#7f1d1d', stroke: '#fca5a5' },
];

const defaultStaticElements = [
  { id: 'static-stage', type: 'stage', label: 'STAGE', x: 0.5, y: 0.14, width: 220, height: 64, rotation: 0 },
  { id: 'static-field', type: 'field', label: 'FIELD', x: 0.5, y: 0.5, width: 260, height: 120, rotation: 0 },
];

const defaultVenueSettings = {
  name: 'Main Venue Layout',
  canvasMode: 'concert',
  showJson: true,
};

const defaultZoneDraft = {
  id: '',
  name: 'VIP Zone',
  price: 250,
  rows: 6,
  seatsPerRow: 16,
  rowLabel: 'A',
  shapeType: 'RECTANGLE',
  x: 0.5,
  y: 0.52,
  rotation: 0,
  rowGap: 34,
  seatSpacing: 30,
};

const round = (value) => Number(Number(value || 0).toFixed(4));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const normalize = ({ x, y }) => ({ x: round(x / DESIGN_WIDTH), y: round(y / DESIGN_HEIGHT) });
const denormalize = ({ x, y }) => ({ x: Number(x || 0) * DESIGN_WIDTH, y: Number(y || 0) * DESIGN_HEIGHT });
const isFiniteNumber = (value) => Number.isFinite(Number(value));

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

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function rowNameFrom(index, startLabel) {
  const base = (startLabel || 'A').trim().toUpperCase().charCodeAt(0) || 65;
  return String.fromCharCode(base + index);
}

function buildRectangleSeats(zone) {
  const seats = [];
  const rows = Number(zone.rows || 1);
  const cols = Number(zone.seatsPerRow || 1);
  const seatSpacing = Number(zone.seatSpacing || 30);
  const rowGap = Number(zone.rowGap || 34);
  const startX = -((cols - 1) * seatSpacing) / 2;
  const startY = -((rows - 1) * rowGap) / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const rowName = rowNameFrom(row, zone.rowLabel);
      seats.push({
        id: `${zone.id}-${row}-${col}`,
        rowName,
        seatNumber: `${rowName}${col + 1}`,
        x: round(startX + col * seatSpacing),
        y: round(startY + row * rowGap),
        rotation: 0,
        status: 'AVAILABLE',
      });
    }
  }

  return seats;
}

function buildSeats(zone) {
  return buildRectangleSeats(zone);
}

function createZoneFromDraft(draft = {}) {
  const x = getSavedRatioCoordinate(draft, 'x', defaultZoneDraft.x);
  const y = getSavedRatioCoordinate(draft, 'y', defaultZoneDraft.y);
  return {
    ...defaultZoneDraft,
    ...draft,
    id: draft.id || draft.zoneId || draft.zone_id || nextId('zone'),
    name: draft.name || draft.zoneName || draft.zone_name || 'Untitled Zone',
    x,
    y,
    price: Number(draft.price || 0),
    rows: Number(draft.rows || 1),
    seatsPerRow: Number(draft.seatsPerRow || 1),
    shapeType: 'RECTANGLE',
    rotation: Number(draft.rotation || 0),
    rowGap: Number(draft.geometry?.rowGap ?? draft.rowGap ?? defaultZoneDraft.rowGap),
    seatSpacing: Number(draft.geometry?.seatSpacing ?? draft.seatSpacing ?? defaultZoneDraft.seatSpacing),
  };
}

function getStaticElementConfig(type) {
  return staticElementOptions.find((element) => element.type === type) || staticElementOptions[0];
}

function createStaticElement(type) {
  const config = getStaticElementConfig(type);
  return {
    id: nextId(`static-${type}`),
    type,
    label: config.label,
    x: 0.5,
    y: type === 'exit' ? 0.86 : 0.5,
    width: config.width,
    height: config.height,
    rotation: 0,
  };
}

function getSavedRatioCoordinate(entity = {}, axis, fallback) {
  const absoluteCenter = entity.absoluteCenter?.[axis];
  if (isFiniteNumber(absoluteCenter)) return round(Number(absoluteCenter));

  const direct = entity[axis];
  if (isFiniteNumber(direct)) return round(Number(direct));

  const snakeOffset = entity[`pos_${axis}`];
  if (isFiniteNumber(snakeOffset)) return round(0.5 + Number(snakeOffset));

  const camelOffset = entity[`pos${axis.toUpperCase()}`];
  if (isFiniteNumber(camelOffset)) return round(0.5 + Number(camelOffset));

  const center = entity.center?.[axis];
  if (isFiniteNumber(center)) return round(0.5 + Number(center));

  return fallback;
}

function hasSavedCoordinate(entity = {}) {
  return ['x', 'y'].some((axis) => (
    isFiniteNumber(entity.absoluteCenter?.[axis])
    || isFiniteNumber(entity[axis])
    || isFiniteNumber(entity[`pos_${axis}`])
    || isFiniteNumber(entity[`pos${axis.toUpperCase()}`])
    || isFiniteNumber(entity.center?.[axis])
  ));
}

function createStaticElementFromSaved(saved = {}, index = 0) {
  const type = saved.type || saved.elementType || saved.element_type || 'stage';
  const config = getStaticElementConfig(type);
  return {
    id: saved.id || nextId(`static-${type}-${index}`),
    type,
    label: saved.label || config.label,
    x: getSavedRatioCoordinate(saved, 'x', type === 'exit' ? 0.86 : 0.5),
    y: getSavedRatioCoordinate(saved, 'y', type === 'stage' ? 0.14 : type === 'exit' ? 0.86 : 0.5),
    width: Number(saved.width || config.width),
    height: Number(saved.height || config.height),
    rotation: Number(saved.rotation || 0),
  };
}

function parseLayoutInput(layout) {
  if (!layout) return null;
  if (typeof layout === 'string') {
    try {
      return JSON.parse(layout);
    } catch {
      return null;
    }
  }
  return layout;
}

function hydrateLayoutState(initialLayout, eventId) {
  const layout = parseLayoutInput(initialLayout) || {};
  const rawZones = Array.isArray(layout.zones)
    ? layout.zones
    : Array.isArray(layout.venue_zones)
      ? layout.venue_zones
      : [];
  const rawStaticElements = Array.isArray(layout.staticElements)
    ? layout.staticElements
    : Array.isArray(layout.static_elements)
      ? layout.static_elements
      : [];
  const hasAnySavedCoordinates = [...rawZones, ...rawStaticElements].some(hasSavedCoordinate);

  const staticElements = rawStaticElements.length
    ? rawStaticElements.map(createStaticElementFromSaved)
    : defaultStaticElements;
  let zones = rawZones.map((zone) => createZoneFromDraft(zone));

  if (zones.length && !hasAnySavedCoordinates) {
    zones = zones.map((zone, index) => ({
      ...zone,
      x: 0.5,
      y: round(clamp(0.36 + index * 0.16, 0.22, 0.88)),
    }));
  }

  const selectedZoneId = zones[0]?.id || '';
  const viewport = layout.viewport || layout.viewState || {};

  return {
    venueSettings: {
      ...defaultVenueSettings,
      ...(layout.venueSettings || layout.venue_settings || {}),
    },
    staticElements,
    zones,
    selectedZoneId,
    selectedStaticId: '',
    draft: createZoneFromDraft(zones[0] || defaultZoneDraft),
    viewportScale: isFiniteNumber(viewport.scale) ? Number(viewport.scale) : 1,
    viewportOffset: {
      x: isFiniteNumber(viewport.offset?.x) ? Number(viewport.offset.x) : 0,
      y: isFiniteNumber(viewport.offset?.y) ? Number(viewport.offset.y) : 0,
    },
    eventId,
  };
}

function getZoneBounds(zone, seats) {
  if (!seats.length) return { minX: -60, maxX: 60, minY: -40, maxY: 40 };
  const xs = seats.map((seat) => seat.x);
  const ys = seats.map((seat) => seat.y);
  return {
    minX: Math.min(...xs) - 18,
    maxX: Math.max(...xs) + 18,
    minY: Math.min(...ys) - 42,
    maxY: Math.max(...ys) + 18,
  };
}

function getZoneArea(zone) {
  const bounds = expandBoundsForZoneTitle(getZoneBounds(zone, buildSeats(zone)), Number(zone.rotation || 0));
  return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
}

function FieldLabel({ children }) {
  return <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{children}</span>;
}

function NumberInput({ label, value, onChange, min, max }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>
  );
}

export default function SeatLayoutBuilder({ eventId, initialLayout, onChange, onSave }) {
  const initialEditorState = useMemo(() => hydrateLayoutState(initialLayout, eventId), [eventId, initialLayout]);
  const containerRef = useRef(null);
  const transformerRef = useRef(null);
  const panStartRef = useRef(null);
  const hydratedEventIdRef = useRef(eventId);
  const zoneRefsRef = useRef(new Map());
  const [stageWidth, setStageWidth] = useState(760);
  const [viewportScale, setViewportScale] = useState(() => initialEditorState.viewportScale);
  const [viewportOffset, setViewportOffset] = useState(() => initialEditorState.viewportOffset);
  const [isPanning, setIsPanning] = useState(false);
  const [venueSettings, setVenueSettings] = useState(() => initialEditorState.venueSettings);
  const [staticElements, setStaticElements] = useState(() => initialEditorState.staticElements);
  const [zones, setZones] = useState(() => initialEditorState.zones);
  const [selectedZoneId, setSelectedZoneId] = useState(() => initialEditorState.selectedZoneId);
  const [selectedStaticId, setSelectedStaticId] = useState(() => initialEditorState.selectedStaticId);
  const [draft, setDraft] = useState(() => initialEditorState.draft);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    node.style.cursor = 'grab';

    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(clamp(entry.contentRect.width, 420, DESIGN_WIDTH));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = stageWidth / DESIGN_WIDTH;
  const stageHeight = Math.min(760, DESIGN_HEIGHT * scale);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) || null;
  const selectedStatic = staticElements.find((element) => element.id === selectedStaticId) || null;
  const isEditingZone = Boolean(selectedZone);
  const isEditingStatic = Boolean(selectedStatic);

  useEffect(() => {
    const incomingLayout = parseLayoutInput(initialLayout) || {};
    const incomingZones = Array.isArray(incomingLayout.zones)
      ? incomingLayout.zones
      : Array.isArray(incomingLayout.venue_zones)
        ? incomingLayout.venue_zones
        : [];
    const shouldHydrate = hydratedEventIdRef.current !== eventId || (!zones.length && incomingZones.length > 0);

    if (!shouldHydrate) return;

    const nextState = hydrateLayoutState(initialLayout, eventId);
    setVenueSettings(nextState.venueSettings);
    setStaticElements(nextState.staticElements);
    setZones(nextState.zones);
    setSelectedZoneId(nextState.selectedZoneId);
    setSelectedStaticId(nextState.selectedStaticId);
    setDraft(nextState.draft);
    setViewportScale(nextState.viewportScale);
    setViewportOffset(nextState.viewportOffset);
    setIsPanning(false);
    panStartRef.current = null;
    hydratedEventIdRef.current = eventId;
  }, [eventId, initialLayout, zones.length]);

  const payload = useMemo(() => ({
    version: 4,
    eventId,
    coordinateSystem: {
      type: 'ratio-from-canvas-center',
      designWidth: DESIGN_WIDTH,
      designHeight: DESIGN_HEIGHT,
      center: { x: 0.5, y: 0.5 },
    },
    viewport: {
      scale: round(viewportScale),
      offset: {
        x: round(viewportOffset.x),
        y: round(viewportOffset.y),
      },
    },
    venueSettings,
    staticElements: staticElements.map((element, zIndex) => ({
      ...element,
      zIndex,
      pos_x: round(Number(element.x || 0) - 0.5),
      pos_y: round(Number(element.y || 0) - 0.5),
      center: {
        x: round(Number(element.x || 0) - 0.5),
        y: round(Number(element.y || 0) - 0.5),
      },
    })),
    zones: zones.map((zone, zIndex) => ({
      id: zone.id,
      name: zone.name,
      price: Number(zone.price || 0),
      shapeType: 'RECTANGLE',
      zIndex,
      pos_x: round(Number(zone.x || 0) - 0.5),
      pos_y: round(Number(zone.y || 0) - 0.5),
      center: {
        x: round(Number(zone.x || 0) - 0.5),
        y: round(Number(zone.y || 0) - 0.5),
      },
      absoluteCenter: {
        x: round(zone.x),
        y: round(zone.y),
      },
      rotation: round(Number(zone.rotation || 0)),
      rows: Number(zone.rows || 0),
      seatsPerRow: Number(zone.seatsPerRow || 0),
      rowLabel: zone.rowLabel || 'A',
      geometry: {
        rowGap: Number(zone.rowGap || 0),
        seatSpacing: Number(zone.seatSpacing || 0),
      },
      seats: buildSeats(zone).map((seat) => ({
        ...seat,
        x: round((denormalize(zone).x + seat.x) / DESIGN_WIDTH - 0.5),
        y: round((denormalize(zone).y + seat.y) / DESIGN_HEIGHT - 0.5),
        absoluteX: round((denormalize(zone).x + seat.x) / DESIGN_WIDTH),
        absoluteY: round((denormalize(zone).y + seat.y) / DESIGN_HEIGHT),
        localX: round(seat.x / DESIGN_WIDTH),
        localY: round(seat.y / DESIGN_HEIGHT),
      })),
    })),
  }), [eventId, staticElements, venueSettings, viewportOffset.x, viewportOffset.y, viewportScale, zones]);

  useEffect(() => {
    onChange?.(payload);
  }, [onChange, payload]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const selectedNode = selectedZoneId ? zoneRefsRef.current.get(selectedZoneId) : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedZoneId, zones]);

  const syncDraft = (zone) => {
    setSelectedZoneId(zone.id);
    setSelectedStaticId('');
    setDraft(createZoneFromDraft(zone));
  };

  const selectStaticElement = (elementId) => {
    setSelectedStaticId(elementId);
    setSelectedZoneId('');
    setDraft(createZoneFromDraft(defaultZoneDraft));
  };

  const clearSelection = () => {
    setSelectedZoneId('');
    setSelectedStaticId('');
    setDraft(createZoneFromDraft(defaultZoneDraft));
  };

  const updateSelectedZone = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (selectedZoneId) {
      setZones((current) => current.map((zone) => (
        zone.id === selectedZoneId ? createZoneFromDraft({ ...zone, ...patch }) : zone
      )));
    }
  };

  const updateDraft = (field, value) => {
    if (selectedZoneId) {
      updateSelectedZone({ [field]: value });
      return;
    }
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addOrUpdateZone = () => {
    const nextZone = createZoneFromDraft({
      ...draft,
      id: selectedZoneId || draft.id || nextId('zone'),
    });

    setZones((current) => {
      const exists = current.some((zone) => zone.id === nextZone.id);
      return exists
        ? current.map((zone) => (zone.id === nextZone.id ? nextZone : zone))
        : [...current, nextZone];
    });
    setSelectedZoneId(nextZone.id);
    setDraft(nextZone);
  };

  const deleteSelectedZone = () => {
    if (!selectedZoneId) return;
    setZones((current) => current.filter((zone) => zone.id !== selectedZoneId));
    clearSelection();
  };

  const deleteSelectedObject = () => {
    if (selectedZoneId) {
      const zone = zones.find((item) => item.id === selectedZoneId);
      const seatCount = zone ? buildSeats(zone).length : 0;
      if (seatCount > 80 && !window.confirm(`Delete ${zone.name} with ${seatCount} seats?`)) {
        return;
      }
      setZones((current) => current.filter((item) => item.id !== selectedZoneId));
      clearSelection();
      return;
    }

    if (selectedStaticId) {
      setStaticElements((current) => current.filter((item) => item.id !== selectedStaticId));
      clearSelection();
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const tagName = event.target?.tagName?.toLowerCase();
      const isTyping = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isTyping) {
        event.preventDefault();
        deleteSelectedObject();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  const updateZonePosition = (zoneId, event) => {
    const point = normalize({ x: event.target.x(), y: event.target.y() });
    setZones((current) => current.map((zone) => (
      zone.id === zoneId ? { ...zone, ...point } : zone
    )));
    setDraft((current) => (current.id === zoneId ? { ...current, ...point } : current));
  };

  const updateStaticPosition = (elementId, event) => {
    const point = normalize({ x: event.target.x(), y: event.target.y() });
    setStaticElements((current) => current.map((element) => (
      element.id === elementId ? { ...element, ...point } : element
    )));
  };

  const syncRotationFromTransformer = () => {
    if (!selectedZoneId) return;
    const node = zoneRefsRef.current.get(selectedZoneId);
    if (!node) return;

    const rotation = round(((node.rotation() % 360) + 360) % 360);
    updateSelectedZone({ rotation });
  };

  const addStaticElement = (type) => {
    setStaticElements((current) => [...current, createStaticElement(type)]);
  };

  const copyJson = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  };

  const setCanvasCursor = (value) => {
    if (containerRef.current) {
      containerRef.current.style.cursor = value;
    }
  };

  const isWorkspaceBackgroundTarget = (target) => {
    if (!target) return false;
    if (target === target.getStage?.()) return true;
    return target.name?.() === 'workspace-background';
  };

  const applyZoom = (nextViewportScale, pointer = { x: stageWidth / 2, y: stageHeight / 2 }) => {
    const oldScale = scale * viewportScale;
    const newScale = scale * nextViewportScale;
    const contentPoint = {
      x: (pointer.x - viewportOffset.x) / oldScale,
      y: (pointer.y - viewportOffset.y) / oldScale,
    };
    const nextPosition = {
      x: round(pointer.x - contentPoint.x * newScale),
      y: round(pointer.y - contentPoint.y * newScale),
    };

    setViewportScale(nextViewportScale);
    setViewportOffset(nextPosition);
  };

  const getRenderableBounds = () => {
    let bounds = {
      minX: DESIGN_WIDTH * 0.35,
      maxX: DESIGN_WIDTH * 0.65,
      minY: DESIGN_HEIGHT * 0.35,
      maxY: DESIGN_HEIGHT * 0.65,
    };

    const expand = (nextBounds) => {
      bounds = {
        minX: Math.min(bounds.minX, nextBounds.minX),
        maxX: Math.max(bounds.maxX, nextBounds.maxX),
        minY: Math.min(bounds.minY, nextBounds.minY),
        maxY: Math.max(bounds.maxY, nextBounds.maxY),
      };
    };

    staticElements.forEach((element) => {
      const point = denormalize(element);
      expand({
        minX: point.x - Number(element.width || 0) / 2,
        maxX: point.x + Number(element.width || 0) / 2,
        minY: point.y - Number(element.height || 0) / 2,
        maxY: point.y + Number(element.height || 0) / 2,
      });
    });

    zones.forEach((zone) => {
      const point = denormalize(zone);
      const boundsForZone = expandBoundsForZoneTitle(
        getZoneBounds(zone, buildSeats(zone)),
        Number(zone.rotation || 0),
      );
      expand({
        minX: point.x + boundsForZone.minX,
        maxX: point.x + boundsForZone.maxX,
        minY: point.y + boundsForZone.minY,
        maxY: point.y + boundsForZone.maxY,
      });
    });

    return bounds;
  };

  const handleCenterView = () => {
    const bounds = getRenderableBounds();
    const contentCenter = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    const delta = {
      x: round((DESIGN_WIDTH / 2 - contentCenter.x) / DESIGN_WIDTH),
      y: round((DESIGN_HEIGHT / 2 - contentCenter.y) / DESIGN_HEIGHT),
    };

    setStaticElements((current) => current.map((element) => ({
      ...element,
      x: round(Number(element.x || 0) + delta.x),
      y: round(Number(element.y || 0) + delta.y),
    })));
    setZones((current) => current.map((zone) => ({
      ...zone,
      x: round(Number(zone.x || 0) + delta.x),
      y: round(Number(zone.y || 0) + delta.y),
    })));
    setViewportScale(1);
    setViewportOffset({ x: 0, y: 0 });
    setCanvasCursor('grab');
  };

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    const nextViewportScale = clamp(round(viewportScale + direction * 0.08), 0.55, 2.2);
    applyZoom(nextViewportScale, pointer);
  };

  useEffect(() => {
    if (!staticElements.length && !zones.length) return;
    console.groupCollapsed('[SeatLayoutBuilder] Canvas object coordinates');
    staticElements.forEach((element) => {
      const point = denormalize(element);
      console.log(`STATIC ${element.label}`, {
        id: element.id,
        x: point.x,
        y: point.y,
        normalizedX: element.x,
        normalizedY: element.y,
        rotation: element.rotation,
        width: element.width,
        height: element.height,
      });
    });
    zones.forEach((zone) => {
      const point = denormalize(zone);
      console.log(`ZONE ${zone.name}`, {
        id: zone.id,
        x: point.x,
        y: point.y,
        normalizedX: zone.x,
        normalizedY: zone.y,
        rotation: zone.rotation,
        rows: zone.rows,
        seatsPerRow: zone.seatsPerRow,
      });
    });
    console.groupEnd();
  }, [staticElements, zones]);

  const totalSeats = zones.reduce((sum, zone) => sum + buildSeats(zone).length, 0);
  const renderedZones = useMemo(() => (
    [...zones].sort((first, second) => {
      if (first.id === selectedZoneId) return 1;
      if (second.id === selectedZoneId) return -1;
      return getZoneArea(second) - getZoneArea(first);
    })
  ), [selectedZoneId, zones]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-200 bg-[linear-gradient(180deg,_#f8fafc,_#ffffff)] p-5 xl:border-b-0 xl:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-500">Layout Controls</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                {isEditingZone ? `Editing ${selectedZone.name}` : isEditingStatic ? `Editing ${selectedStatic.label}` : 'Venue workspace'}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {isEditingZone
                  ? 'Zone properties update live on the canvas. Drag the handles to rotate or change curvature.'
                  : isEditingStatic
                    ? 'Static anchors can be moved, renamed, rotated, or deleted like design objects.'
                    : 'No object selected. Configure the venue, add static anchors, or prepare a new seat zone.'}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                isEditingZone || isEditingStatic ? 'border-violet-200 text-violet-700 hover:bg-violet-50' : 'border-slate-200 text-slate-400'
              }`}
            >
              <MousePointer2 size={14} />
            </button>
          </div>

          {!isEditingZone && !isEditingStatic ? (
            <div className="mt-5 space-y-5">
              <label className="block">
                <FieldLabel>Venue Layout Name</FieldLabel>
                <input
                  value={venueSettings.name}
                  onChange={(event) => setVenueSettings((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <div>
                <FieldLabel>Static Elements</FieldLabel>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {staticElementOptions.map((element) => (
                    <button
                      key={element.type}
                      type="button"
                      onClick={() => addStaticElement(element.type)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
                    >
                      {element.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-900">New Zone Preset</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Every new zone uses a rectangle grid. Add it to canvas, then adjust rows, spacing, position, and rotation.</p>
                <button
                  type="button"
                  onClick={addOrUpdateZone}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500"
                >
                  <Plus size={16} />
                  Add Zone to Canvas
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Zones</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{zones.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Seats</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{totalSeats}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Anchors</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{staticElements.length}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-900">Object Layers</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Use this list to select objects hidden underneath overlapping zones.</p>
                <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                  {staticElements.map((element) => (
                    <button
                      key={element.id}
                      type="button"
                      onClick={() => selectStaticElement(element.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
                    >
                      <span>{element.label}</span>
                      <span className="text-slate-400">anchor</span>
                    </button>
                  ))}
                  {zones.map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => syncDraft(zone)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
                    >
                      <span>{zone.name}</span>
                      <span className="text-slate-400">RECTANGLE</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : isEditingStatic ? (
            <div className="mt-5 space-y-4">
              <label className="block">
                <FieldLabel>Label</FieldLabel>
                <input
                  value={selectedStatic.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    setStaticElements((current) => current.map((element) => (
                      element.id === selectedStaticId ? { ...element, label } : element
                    )));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Rotation"
                  value={selectedStatic.rotation || 0}
                  onChange={(rotation) => setStaticElements((current) => current.map((element) => (
                    element.id === selectedStaticId ? { ...element, rotation } : element
                  )))}
                />
                <NumberInput
                  label="Width"
                  value={selectedStatic.width}
                  onChange={(width) => setStaticElements((current) => current.map((element) => (
                    element.id === selectedStaticId ? { ...element, width } : element
                  )))}
                />
                <NumberInput
                  label="Height"
                  value={selectedStatic.height}
                  onChange={(height) => setStaticElements((current) => current.map((element) => (
                    element.id === selectedStaticId ? { ...element, height } : element
                  )))}
                />
              </div>

              <button
                type="button"
                onClick={deleteSelectedObject}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"
              >
                <Trash2 size={16} />
                Delete Static Element
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <label className="block">
                <FieldLabel>Zone Name</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft('name', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Price" value={draft.price} onChange={(value) => updateDraft('price', value)} />
                <label className="block">
                  <FieldLabel>Row Label</FieldLabel>
                  <input
                    value={draft.rowLabel}
                    maxLength={2}
                    onChange={(event) => updateDraft('rowLabel', event.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Rows" value={draft.rows} onChange={(value) => updateDraft('rows', value)} min={1} max={30} />
                <NumberInput label="Seats / Row" value={draft.seatsPerRow} onChange={(value) => updateDraft('seatsPerRow', value)} min={1} max={80} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Rotation" value={draft.rotation} onChange={(value) => updateDraft('rotation', value)} />
                <NumberInput label="Seat Spacing" value={draft.seatSpacing} onChange={(value) => updateDraft('seatSpacing', value)} />
              </div>

              <NumberInput label="Row Gap" value={draft.rowGap} onChange={(value) => updateDraft('rowGap', value)} />

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
                <p className="font-bold text-slate-800">Canvas handles</p>
                <p>Use the Transformer handle above the selected rectangle zone to rotate the whole seating block.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
                >
                  <RotateCcw size={16} />
                  Done
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedObject}
                  className="inline-flex items-center justify-center rounded-full border border-red-100 bg-white px-4 py-2.5 text-red-500 transition hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
        </aside>

        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-500">Design Canvas</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">Interactive venue editor</h3>
              <p className="mt-1 text-sm text-slate-500">Drag zones and anchors. Click empty canvas to return to venue controls.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyZoom(clamp(round(viewportScale - 0.12), 0.55, 2.2))}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
              >
                -
              </button>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                {Math.round(viewportScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => applyZoom(clamp(round(viewportScale + 0.12), 0.55, 2.2))}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
              >
                +
              </button>
              <button
                type="button"
                onClick={handleCenterView}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
              >
                <LocateFixed size={15} />
                Center View
              </button>
              <button
                type="button"
                onClick={copyJson}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
              >
                <Copy size={15} />
                Copy JSON
              </button>
              <button
                type="button"
                onClick={() => onSave?.(payload)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <Save size={15} />
                Save Layout
              </button>
            </div>
          </div>

          <div ref={containerRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            <Stage
              width={stageWidth}
              height={stageHeight}
              onWheel={handleWheel}
              onMouseDown={(event) => {
                const isBlank = isWorkspaceBackgroundTarget(event.target);
                if (isBlank) {
                  clearSelection();
                  setIsPanning(true);
                  setCanvasCursor('grabbing');
                  const pointer = event.target.getStage()?.getPointerPosition();
                  if (pointer) {
                    panStartRef.current = {
                      pointer,
                      offset: viewportOffset,
                    };
                  }
                  return;
                }
              }}
              onMouseMove={(event) => {
                if (isPanning) {
                  const pointer = event.target.getStage()?.getPointerPosition();
                  if (pointer && panStartRef.current) {
                    setViewportOffset({
                      x: round(panStartRef.current.offset.x + pointer.x - panStartRef.current.pointer.x),
                      y: round(panStartRef.current.offset.y + pointer.y - panStartRef.current.pointer.y),
                    });
                  }
                  setCanvasCursor('grabbing');
                  return;
                }
                setCanvasCursor(isWorkspaceBackgroundTarget(event.target) ? 'grab' : 'default');
              }}
              onMouseUp={() => {
                setIsPanning(false);
                panStartRef.current = null;
                setCanvasCursor('grab');
              }}
              onMouseLeave={() => {
                setIsPanning(false);
                panStartRef.current = null;
                setCanvasCursor('default');
              }}
            >
              <Layer x={viewportOffset.x} y={viewportOffset.y} scaleX={scale * viewportScale} scaleY={scale * viewportScale}>
                <Rect
                  name="workspace-background"
                  width={DESIGN_WIDTH}
                  height={DESIGN_HEIGHT}
                  fill="#020617"
                  onClick={clearSelection}
                  onTap={clearSelection}
                />
                <Line points={[DESIGN_WIDTH / 2, 0, DESIGN_WIDTH / 2, DESIGN_HEIGHT]} stroke="#1e293b" strokeWidth={1} dash={[8, 10]} />
                <Line points={[0, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT / 2]} stroke="#1e293b" strokeWidth={1} dash={[8, 10]} />

                {staticElements.map((element) => {
                  const point = denormalize(element);
                  const config = getStaticElementConfig(element.type);
                  const isSelected = element.id === selectedStaticId;
                  const elementRotation = Number(element.rotation || 0);
                  return (
                    <Group
                      key={element.id}
                      x={point.x}
                      y={point.y}
                      rotation={elementRotation}
                      draggable
                      onClick={(event) => {
                        event.cancelBubble = true;
                        selectStaticElement(element.id);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        selectStaticElement(element.id);
                      }}
                      onDragEnd={(event) => updateStaticPosition(element.id, event)}
                    >
                      <Rect
                        x={-element.width / 2}
                        y={-element.height / 2}
                        width={element.width}
                        height={element.height}
                        cornerRadius={element.type === 'exit' ? 12 : 24}
                        fill={config.fill}
                        stroke={isSelected ? '#ffffff' : config.stroke}
                        strokeWidth={isSelected ? 3 : 2}
                        opacity={0.9}
                      />
                      <Group rotation={-elementRotation}>
                        <Text
                          x={-element.width / 2}
                          y={-8}
                          width={element.width}
                          text={element.label}
                          fill="#ffffff"
                          fontStyle="bold"
                          fontSize={16}
                          align="center"
                        />
                      </Group>
                      {isSelected ? (
                        <Group
                          x={element.width / 2 + 18}
                          y={-element.height / 2 - 18}
                          rotation={-elementRotation}
                          onClick={(event) => {
                            event.cancelBubble = true;
                            deleteSelectedObject();
                          }}
                          onTap={(event) => {
                            event.cancelBubble = true;
                            deleteSelectedObject();
                          }}
                        >
                          <Circle radius={16} fill="#ef4444" stroke="#fecaca" strokeWidth={2} />
                          <Text x={-7} y={-7} text="×" fill="#fff" fontStyle="bold" fontSize={18} />
                        </Group>
                      ) : null}
                    </Group>
                  );
                })}

                {renderedZones.map((zone) => {
                  const point = denormalize(zone);
                  const seats = buildSeats(zone);
                  const isSelected = zone.id === selectedZoneId;
                  const zoneRotation = Number(zone.rotation || 0);
                  const bounds = expandBoundsForZoneTitle(getZoneBounds(zone, seats), zoneRotation);
                  const labelPosition = getSmartZoneLabelPosition(bounds, zoneRotation);

                  return (
                    <Group
                      key={zone.id}
                      ref={(node) => {
                        if (node) {
                          zoneRefsRef.current.set(zone.id, node);
                        } else {
                          zoneRefsRef.current.delete(zone.id);
                        }
                      }}
                      x={point.x}
                      y={point.y}
                      rotation={zoneRotation}
                      draggable
                      onClick={(event) => {
                        event.cancelBubble = true;
                        syncDraft(zone);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        syncDraft(zone);
                      }}
                      onDragEnd={(event) => updateZonePosition(zone.id, event)}
                    >
                      <Rect
                        x={bounds.minX}
                        y={bounds.minY}
                        width={bounds.maxX - bounds.minX}
                        height={bounds.maxY - bounds.minY}
                        fill="rgba(124,58,237,0.01)"
                        listening
                      />
                      {isSelected ? (
                        <Rect
                          x={bounds.minX}
                          y={bounds.minY}
                          width={bounds.maxX - bounds.minX}
                          height={bounds.maxY - bounds.minY}
                          cornerRadius={18}
                          stroke="#a78bfa"
                          strokeWidth={2}
                          dash={[10, 8]}
                          opacity={0.85}
                          shadowColor="#a78bfa"
                          shadowBlur={18}
                          shadowOpacity={0.3}
                        />
                      ) : null}

                      <Group
                        x={labelPosition.x}
                        y={labelPosition.y}
                        rotation={-zoneRotation}
                        listening={false}
                      >
                        <Rect
                          x={-88}
                          y={-13}
                          width={176}
                          height={ZONE_LABEL_HEIGHT}
                          cornerRadius={10}
                          fill={isSelected ? '#6d28d9' : '#1e1b4b'}
                          opacity={0.86}
                          stroke="#a78bfa"
                          strokeWidth={1}
                        />
                        <Text
                          x={-78}
                          y={-7}
                          text={`${zone.name}  $${Number(zone.price || 0).toLocaleString()}`}
                          fill="#ede9fe"
                          fontStyle="bold"
                          fontSize={12}
                          width={156}
                          align="center"
                        />
                      </Group>

                      {seats.map((seat) => (
                        <Group
                          key={seat.id}
                          x={seat.x}
                          y={seat.y}
                        >
                          <Circle
                            radius={SEAT_RADIUS}
                            fill={isSelected ? '#a78bfa' : '#8b5cf6'}
                            stroke={isSelected ? '#ffffff' : '#ddd6fe'}
                            strokeWidth={isSelected ? 1.8 : 1}
                            shadowColor="#8b5cf6"
                            shadowBlur={isSelected ? 8 : 4}
                            shadowOpacity={0.28}
                          />
                          <Group rotation={-zoneRotation}>
                            <Text
                              x={-8}
                              y={-5}
                              width={16}
                              align="center"
                              text={seatNumberLabel(seat.seatNumber)}
                              fill="#ffffff"
                              fontStyle="bold"
                              fontSize={8}
                            />
                          </Group>
                        </Group>
                      ))}

                      {isSelected ? (
                        <>
                          <Group
                            x={bounds.maxX + 18}
                            y={bounds.minY - 16}
                            rotation={-zoneRotation}
                            onClick={(event) => {
                              event.cancelBubble = true;
                              deleteSelectedObject();
                            }}
                            onTap={(event) => {
                              event.cancelBubble = true;
                              deleteSelectedObject();
                            }}
                          >
                            <Circle radius={16} fill="#ef4444" stroke="#fecaca" strokeWidth={2} />
                            <Text x={-7} y={-7} text="×" fill="#fff" fontStyle="bold" fontSize={18} />
                          </Group>

                        </>
                      ) : null}
                    </Group>
                  );
                })}

                <Transformer
                  ref={transformerRef}
                  rotateEnabled
                  resizeEnabled={false}
                  enabledAnchors={[]}
                  borderStroke="#a78bfa"
                  borderStrokeWidth={2}
                  borderDash={[8, 6]}
                  rotateAnchorOffset={42}
                  rotateAnchorCursor="grab"
                  anchorSize={12}
                  anchorFill="#7c3aed"
                  anchorStroke="#ddd6fe"
                  anchorStrokeWidth={2}
                  onTransform={syncRotationFromTransformer}
                  onTransformEnd={syncRotationFromTransformer}
                />
              </Layer>
            </Stage>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Zones</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{zones.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Seats</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{totalSeats}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Anchors</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{staticElements.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Selected</p>
              <p className="mt-2 truncate text-lg font-black text-slate-950">{selectedZone?.name || 'Venue'}</p>
            </div>
          </div>

          {venueSettings.showJson ? (
            <pre className="max-h-56 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              {JSON.stringify(payload, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}
