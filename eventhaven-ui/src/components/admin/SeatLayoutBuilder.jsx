import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { LocateFixed, MousePointer2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';

const DESIGN_WIDTH = 980;
const DESIGN_HEIGHT = 760;
const GRID_SIZE = 80;
const VIEWPORT_PADDING = 96;
const MIN_VIEWPORT_SCALE = 0.3;
const MAX_VIEWPORT_SCALE = 1.5;
const ZOOM_STEP = 0.12;
const SEAT_RADIUS = 6;
const ZONE_BOUNDS_PADDING = SEAT_RADIUS + 4;
const ZONE_TOOLTIP_HEIGHT = 34;

const staticElementOptions = [
  { type: 'stage', label: 'STAGE', width: 220, height: 64, fill: '#312e81', stroke: '#a78bfa' },
  { type: 'exit', label: 'EXIT', width: 92, height: 44, fill: '#7f1d1d', stroke: '#fca5a5' },
];

const defaultStaticElements = [
  { id: 'static-stage', type: 'stage', label: 'STAGE', x: 0.5, y: 0.14, width: 220, height: 64, rotation: 0 },
];

const defaultVenueSettings = {
  name: 'Main Venue Layout',
  canvasMode: 'concert',
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

function createStaticElement(type, position = {}) {
  const config = getStaticElementConfig(type);
  return {
    id: nextId(`static-${type}`),
    type,
    label: config.label,
    x: position.x ?? 0.5,
    y: position.y ?? 0.5,
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
    minX: Math.min(...xs) - ZONE_BOUNDS_PADDING,
    maxX: Math.max(...xs) + ZONE_BOUNDS_PADDING,
    minY: Math.min(...ys) - ZONE_BOUNDS_PADDING,
    maxY: Math.max(...ys) + ZONE_BOUNDS_PADDING,
  };
}

function getZoneArea(zone) {
  const bounds = getZoneBounds(zone, buildSeats(zone));
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
  const autoCenteredLayoutRef = useRef('');
  const zoneRefsRef = useRef(new Map());
  const staticRefsRef = useRef(new Map());
  const [stageWidth, setStageWidth] = useState(980);
  const [stageHeight, setStageHeight] = useState(680);
  const [viewportScale, setViewportScale] = useState(() => clamp(initialEditorState.viewportScale, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE));
  const [zoomInput, setZoomInput] = useState(() => String(Math.round(clamp(initialEditorState.viewportScale, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE) * 100)));
  const [viewportOffset, setViewportOffset] = useState(() => initialEditorState.viewportOffset);
  const [isPanning, setIsPanning] = useState(false);
  const [venueSettings, setVenueSettings] = useState(() => initialEditorState.venueSettings);
  const [staticElements, setStaticElements] = useState(() => initialEditorState.staticElements);
  const [zones, setZones] = useState(() => initialEditorState.zones);
  const [selectedZoneId, setSelectedZoneId] = useState(() => initialEditorState.selectedZoneId);
  const [selectedStaticId, setSelectedStaticId] = useState(() => initialEditorState.selectedStaticId);
  const [draft, setDraft] = useState(() => initialEditorState.draft);
  const [zoneTooltip, setZoneTooltip] = useState(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    node.style.cursor = 'grab';

    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(Math.max(520, Math.floor(entry.contentRect.width)));
      setStageHeight(Math.max(560, Math.floor(entry.contentRect.height)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = stageWidth / DESIGN_WIDTH;
  const effectiveScale = scale * viewportScale;
  const gridSpacing = Math.max(24, GRID_SIZE * effectiveScale);
  const gridOffsetX = ((viewportOffset.x % gridSpacing) + gridSpacing) % gridSpacing;
  const gridOffsetY = ((viewportOffset.y % gridSpacing) + gridSpacing) % gridSpacing;
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) || null;
  const selectedStatic = staticElements.find((element) => element.id === selectedStaticId) || null;
  const isEditingZone = Boolean(selectedZone);
  const isEditingStatic = Boolean(selectedStatic);

  useEffect(() => {
    setZoomInput(String(Math.round(viewportScale * 100)));
  }, [viewportScale]);

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
    setViewportScale(clamp(nextState.viewportScale, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE));
    setViewportOffset(nextState.viewportOffset);
    setIsPanning(false);
    panStartRef.current = null;
    hydratedEventIdRef.current = eventId;
    autoCenteredLayoutRef.current = '';
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

    const selectedNode = selectedZoneId
      ? zoneRefsRef.current.get(selectedZoneId)
      : selectedStaticId
        ? staticRefsRef.current.get(selectedStaticId)
        : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedStaticId, selectedZoneId, zones, staticElements]);

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

  const syncTransformFromTransformer = () => {
    const node = selectedZoneId
      ? zoneRefsRef.current.get(selectedZoneId)
      : selectedStaticId
        ? staticRefsRef.current.get(selectedStaticId)
        : null;
    if (!node) return;

    const rotation = round(((node.rotation() % 360) + 360) % 360);

    if (selectedZoneId) {
      updateSelectedZone({ rotation });
      return;
    }

    if (selectedStaticId) {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const width = Math.max(32, round(Number(selectedStatic?.width || 0) * scaleX));
      const height = Math.max(24, round(Number(selectedStatic?.height || 0) * scaleY));

      node.scaleX(1);
      node.scaleY(1);

      setStaticElements((current) => current.map((element) => (
        element.id === selectedStaticId ? { ...element, rotation, width, height } : element
      )));
    }
  };

  const getViewportCenterPosition = () => {
    const currentScale = scale * viewportScale;
    if (!currentScale) return { x: 0.5, y: 0.5 };

    return {
      x: round(clamp(((stageWidth / 2 - viewportOffset.x) / currentScale) / DESIGN_WIDTH, -10, 10)),
      y: round(clamp(((stageHeight / 2 - viewportOffset.y) / currentScale) / DESIGN_HEIGHT, -10, 10)),
    };
  };

  const addStaticElement = (type) => {
    const nextElement = createStaticElement(type, getViewportCenterPosition());
    setStaticElements((current) => [...current, nextElement]);
    setSelectedStaticId(nextElement.id);
    setSelectedZoneId('');
    setDraft(createZoneFromDraft(defaultZoneDraft));
  };

  const setCanvasCursor = (value) => {
    if (containerRef.current) {
      containerRef.current.style.cursor = value;
    }
  };

  const updateZoneTooltip = (event, zone) => {
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;

    const text = `${zone.name || 'Untitled Zone'}  $${Number(zone.price || 0).toLocaleString()}`;
    const width = clamp(text.length * 7.5 + 28, 150, 320);
    setZoneTooltip({
      text,
      width,
      x: clamp(pointer.x + 16, 8, stageWidth - width - 8),
      y: clamp(pointer.y + 16, 8, stageHeight - ZONE_TOOLTIP_HEIGHT - 8),
    });
  };

  const isWorkspaceBackgroundTarget = (target) => {
    if (!target) return false;
    if (target === target.getStage?.()) return true;
    return target.name?.() === 'viewport-background';
  };

  const applyZoom = (nextViewportScale, pointer = { x: stageWidth / 2, y: stageHeight / 2 }) => {
    const clampedScale = clamp(round(nextViewportScale), MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
    const oldScale = scale * viewportScale;
    const newScale = scale * clampedScale;
    const contentPoint = {
      x: (pointer.x - viewportOffset.x) / oldScale,
      y: (pointer.y - viewportOffset.y) / oldScale,
    };
    const nextPosition = {
      x: round(pointer.x - contentPoint.x * newScale),
      y: round(pointer.y - contentPoint.y * newScale),
    };

    setViewportScale(clampedScale);
    setViewportOffset(nextPosition);
  };

  const commitZoomInput = () => {
    const percent = Number(zoomInput);
    const safePercent = Number.isFinite(percent) ? percent : Math.round(viewportScale * 100);
    const nextViewportScale = clamp(safePercent / 100, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
    applyZoom(nextViewportScale);
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
      const boundsForZone = getZoneBounds(zone, buildSeats(zone));
      expand({
        minX: point.x + boundsForZone.minX,
        maxX: point.x + boundsForZone.maxX,
        minY: point.y + boundsForZone.minY,
        maxY: point.y + boundsForZone.maxY,
      });
    });

    return bounds;
  };

  const centerMapLayout = useCallback(() => {
    if (!stageWidth || !stageHeight) return;

    const bounds = getRenderableBounds();
    const contentCenter = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    const contentWidth = Math.max(bounds.maxX - bounds.minX, 320);
    const contentHeight = Math.max(bounds.maxY - bounds.minY, 240);
    const fitScale = clamp(
      Math.min((stageWidth - VIEWPORT_PADDING) / contentWidth, (stageHeight - VIEWPORT_PADDING) / contentHeight) / scale,
      MIN_VIEWPORT_SCALE,
      MAX_VIEWPORT_SCALE,
    );

    setViewportScale(round(fitScale));
    setViewportOffset({
      x: round(stageWidth / 2 - contentCenter.x * scale * fitScale),
      y: round(stageHeight / 2 - contentCenter.y * scale * fitScale),
    });
    setCanvasCursor('grab');
  }, [scale, stageHeight, stageWidth, staticElements, zones]);

  const handleCenterView = () => {
    centerMapLayout();
  };

  useEffect(() => {
    if (!stageWidth || !stageHeight || (!staticElements.length && !zones.length)) return;

    const layoutKey = String(eventId || 'draft-event');
    if (autoCenteredLayoutRef.current === layoutKey) return;

    centerMapLayout();
    autoCenteredLayoutRef.current = layoutKey;
  }, [centerMapLayout, eventId, stageHeight, stageWidth, staticElements, zones]);

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    const nextViewportScale = clamp(round(viewportScale + direction * 0.08), MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
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
      <div className="grid min-h-[760px] gap-0 xl:grid-cols-[300px_1fr]">
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
                <div className="mt-2 grid grid-cols-2 gap-2">
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

        <div className="space-y-4 bg-slate-50/70 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-500">Design Canvas</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">Interactive venue editor</h3>
              <p className="mt-1 text-sm text-slate-500">Drag zones and anchors. Click empty canvas to return to venue controls.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyZoom(clamp(round(viewportScale - ZOOM_STEP), MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE))}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:border-violet-200 hover:text-violet-600"
              >
                -
              </button>
              <label className="relative inline-flex items-center">
                <input
                  type="number"
                  min={Math.round(MIN_VIEWPORT_SCALE * 100)}
                  max={Math.round(MAX_VIEWPORT_SCALE * 100)}
                  value={zoomInput}
                  onChange={(event) => setZoomInput(event.target.value)}
                  onBlur={commitZoomInput}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-10 w-20 rounded-full border border-slate-200 bg-white px-3 pr-7 text-center text-xs font-bold text-slate-600 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  aria-label="Zoom percentage"
                />
                <span className="pointer-events-none absolute right-3 text-xs font-bold text-slate-400">%</span>
              </label>
              <button
                type="button"
                onClick={() => applyZoom(clamp(round(viewportScale + ZOOM_STEP), MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE))}
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
                onClick={() => onSave?.(payload)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <Save size={15} />
                Save Layout
              </button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="h-[68vh] min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner"
          >
            <Stage
              width={stageWidth}
              height={stageHeight}
              onWheel={handleWheel}
              onMouseDown={(event) => {
                setZoneTooltip(null);
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
                setZoneTooltip(null);
              }}
            >
              <Layer>
                <Rect
                  name="viewport-background"
                  width={stageWidth}
                  height={stageHeight}
                  fill="#f8fafc"
                  onClick={clearSelection}
                  onTap={clearSelection}
                />
                {Array.from({ length: Math.ceil(stageWidth / gridSpacing) + 2 }, (_, index) => (
                  <Line
                    key={`viewport-grid-x-${index}`}
                    points={[gridOffsetX + (index - 1) * gridSpacing, 0, gridOffsetX + (index - 1) * gridSpacing, stageHeight]}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    listening={false}
                  />
                ))}
                {Array.from({ length: Math.ceil(stageHeight / gridSpacing) + 2 }, (_, index) => (
                  <Line
                    key={`viewport-grid-y-${index}`}
                    points={[0, gridOffsetY + (index - 1) * gridSpacing, stageWidth, gridOffsetY + (index - 1) * gridSpacing]}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    listening={false}
                  />
                ))}
              </Layer>
              <Layer x={viewportOffset.x} y={viewportOffset.y} scaleX={scale * viewportScale} scaleY={scale * viewportScale}>
                <Rect
                  x={0}
                  y={0}
                  width={DESIGN_WIDTH}
                  height={DESIGN_HEIGHT}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  dash={[12, 10]}
                  listening={false}
                />
                <Line points={[DESIGN_WIDTH / 2, 0, DESIGN_WIDTH / 2, DESIGN_HEIGHT]} stroke="#94a3b8" strokeWidth={1.4} dash={[8, 10]} />
                <Line points={[0, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT / 2]} stroke="#94a3b8" strokeWidth={1.4} dash={[8, 10]} />

                {staticElements.map((element) => {
                  const point = denormalize(element);
                  const config = getStaticElementConfig(element.type);
                  const isSelected = element.id === selectedStaticId;
                  const elementRotation = Number(element.rotation || 0);
                  return (
                    <Group
                      key={element.id}
                      ref={(node) => {
                        if (node) {
                          staticRefsRef.current.set(element.id, node);
                        } else {
                          staticRefsRef.current.delete(element.id);
                        }
                      }}
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
                      {false && isSelected ? (
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
                  const bounds = getZoneBounds(zone, seats);

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
                      onMouseEnter={(event) => updateZoneTooltip(event, zone)}
                      onMouseMove={(event) => updateZoneTooltip(event, zone)}
                      onMouseLeave={() => setZoneTooltip(null)}
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
                        />
                      ) : null}

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

                      {false && isSelected ? (
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
                  keepRatio={false}
                  ignoreStroke
                  boundBoxFunc={(oldBox, newBox) => {
                    if (!selectedStaticId) return oldBox;
                    if (Math.abs(newBox.width) < 32 || Math.abs(newBox.height) < 24) return oldBox;
                    return newBox;
                  }}
                  borderStroke="#a78bfa"
                  borderStrokeWidth={2}
                  borderDash={[8, 6]}
                  rotateAnchorOffset={42}
                  rotateAnchorCursor="grab"
                  anchorSize={12}
                  anchorFill="#7c3aed"
                  anchorStroke="#ddd6fe"
                  anchorStrokeWidth={2}
                  onTransform={syncTransformFromTransformer}
                  onTransformEnd={syncTransformFromTransformer}
                />
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

        </div>
      </div>
    </section>
  );
}
