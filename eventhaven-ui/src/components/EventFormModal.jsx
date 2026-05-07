import { useEffect, useState } from 'react';
import api from '../services/api';
import SeatMapRenderer from './seat-map/SeatMapRenderer';

const EMPTY_FORM = {
  name: '',
  description: '',
  organizer: '',
  category: '',
  startTime: '',
  endTime: '',
  imageUrl: '',
  venueId: '',
  venueName: '',
  venueAddress: '',
  zones: [],
  tiers: [],
  seatLayout: null,
};

const categories = ['Concert', 'Sport', 'Theater', 'Conference', 'General'];

const inputCls = (error) =>
  `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
    error
      ? 'border-red-400 focus:ring-2 focus:ring-red-200'
      : 'border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  }`;

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function normalizeInitial(initial) {
  if (!initial) {
    return {
      ...EMPTY_FORM,
    };
  }

  return {
    name: initial.name || '',
    description: initial.description || '',
    organizer: initial.organizer || '',
    category: initial.category || '',
    startTime: toDateTimeLocal(initial.startTime),
    endTime: toDateTimeLocal(initial.endTime),
    imageUrl: initial.bannerUrl || initial.imageUrl || '',
    venueId: initial.venue?.id || '',
    venueName: initial.venue?.name || '',
    venueAddress: initial.venue?.address || initial.location || '',
    seatLayout: parseSeatLayout(initial.seatLayout || initial.seatLayoutJson),
  };
}

function parseSeatLayout(seatLayout) {
  if (!seatLayout) return null;
  if (typeof seatLayout === 'string') {
    try {
      return JSON.parse(seatLayout);
    } catch {
      return null;
    }
  }
  return seatLayout;
}

function getLayoutZones(seatLayout) {
  const parsedLayout = parseSeatLayout(seatLayout);
  if (Array.isArray(parsedLayout?.zones)) return parsedLayout.zones;
  if (Array.isArray(parsedLayout?.venue_zones)) return parsedLayout.venue_zones;
  return [];
}

function persistedNumericId(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export default function EventFormModal({ initial, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => normalizeInitial(initial));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(normalizeInitial(initial));
    setStep(1);
    setErrors({});
  }, [initial]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const layoutZones = getLayoutZones(form.seatLayout);
  const isSeatLayoutReady = layoutZones.length > 0 && layoutZones.every((zone) => (
    String(zone.name || '').trim()
    && Number(zone.price || 0) > 0
    && Number(zone.rows || 0) > 0
    && Number(zone.seatsPerRow || 0) > 0
  ));

  const validate = () => {
    const nextErrors = {};

    if (step === 1) {
      if (!form.name.trim()) nextErrors.name = 'Event title is required';
      if (!form.category.trim()) nextErrors.category = 'Category is required';
      if (!form.organizer.trim()) nextErrors.organizer = 'Organizer is required';
    }

    if (step === 2) {
      if (!form.venueAddress.trim()) nextErrors.venueAddress = 'Venue address is required';
      if (!form.startTime) nextErrors.startTime = 'Start date & time is required';
    }

    if (step === 3) {
      const layoutZones = getLayoutZones(form.seatLayout);
      const zoneNames = new Set();

      if (!layoutZones.length) {
        nextErrors.seatLayout = 'Add at least one zone to the canvas.';
      }

      layoutZones.forEach((zone, index) => {
        const name = String(zone.name || '').trim();
        const price = Number(zone.price || 0);
        const rows = Number(zone.rows || 0);
        const seatsPerRow = Number(zone.seatsPerRow || 0);

        if (!name) nextErrors[`layout_zone_${index}`] = 'Each zone needs a name.';
        if (name) {
          const normalizedName = name.toLowerCase();
          if (zoneNames.has(normalizedName)) nextErrors[`layout_zone_${index}`] = 'Zone names must be unique.';
          zoneNames.add(normalizedName);
        }
        if (!price || Number.isNaN(price) || price <= 0) nextErrors[`layout_zone_${index}_price`] = 'Each zone needs a price greater than 0.';
        if (!rows || Number.isNaN(rows) || rows < 1) nextErrors[`layout_zone_${index}_rows`] = 'Each zone needs at least one row.';
        if (!seatsPerRow || Number.isNaN(seatsPerRow) || seatsPerRow < 1) nextErrors[`layout_zone_${index}_seats`] = 'Each zone needs seats per row.';
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validate()) {
      setStep((current) => current + 1);
    }
  };

  const back = () => {
    setStep((current) => current - 1);
  };

  const submit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const totalCapacity = layoutZones.reduce((sum, zone) => sum + Number(zone.seats?.length || 0), 0);

      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        organizer: form.organizer.trim(),
        description: form.description.trim() || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        imageUrl: form.imageUrl.trim() || null,
        bannerUrl: form.imageUrl.trim() || null,
        venue: {
          id: form.venueId || null,
          name: form.venueName.trim() || 'Custom Venue',
          address: form.venueAddress.trim(),
          totalCapacity,
        },
        zones: layoutZones.map((zone) => ({
          id: persistedNumericId(zone.id),
          name: String(zone.name || '').trim(),
          description: 'RECTANGLE layout zone',
          rows: Number(zone.rows || 0),
          seatsPerRow: Number(zone.seatsPerRow || 0),
          rowPrefix: zone.rowLabel || 'A',
          seatCount: Number(zone.seats?.length || 0),
          layoutX: zone.absoluteCenter?.x ?? null,
          layoutY: zone.absoluteCenter?.y ?? null,
          rotation: Number(zone.rotation || 0),
          shapeType: 'RECTANGLE',
        })),
        priceTiers: layoutZones.map((zone) => ({
          zoneId: persistedNumericId(zone.id),
          zoneName: String(zone.name || '').trim(),
          tierName: String(zone.name || '').trim(),
          price: Number(zone.price || 0),
        })),
        seatLayout: form.seatLayout,
      };

      const response = initial?.id
        ? await api.put(`/events/${initial.id}`, payload)
        : await api.post('/events', payload);

      const apiMessage = response.data?.message
        || (initial ? 'Event updated successfully' : 'Event created successfully');

      onSaved(apiMessage, 'success');
    } catch (error) {
      onSaved(error.response?.data?.message || error.message || 'Unable to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className={`flex max-h-[96vh] w-full flex-col rounded-[28px] bg-white shadow-2xl ${step === 3 ? 'max-w-[96vw] 2xl:max-w-7xl' : 'max-w-3xl'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">{initial ? 'Edit Event' : 'Create New Event'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">Step {step} of 3</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 px-6 py-3">
          {['Basic Info', 'Venue & Media', 'Pricing & Seats'].map((label, index) => (
            <div key={label} className="flex-1 text-center">
              <div className={`mb-1 h-1 rounded-full ${step > index ? 'bg-violet-600' : 'bg-slate-200'}`} />
              <span className={`text-xs ${step === index + 1 ? 'font-semibold text-violet-600' : 'text-slate-400'}`}>{label}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <>
              <Field label="Event Title *" error={errors.name}>
                <input
                  className={inputCls(errors.name)}
                  placeholder="e.g. Summer Music Festival 2026"
                  value={form.name}
                  onChange={(event) => setField('name', event.target.value)}
                />
              </Field>

              <Field label="Category *" error={errors.category}>
                <select
                  className={inputCls(errors.category)}
                  value={form.category}
                  onChange={(event) => setField('category', event.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </Field>

              <Field label="Organizer *" error={errors.organizer}>
                <input
                  className={inputCls(errors.organizer)}
                  placeholder="Organizer name"
                  value={form.organizer}
                  onChange={(event) => setField('organizer', event.target.value)}
                />
              </Field>

              <Field label="Description">
                <textarea
                  className={inputCls()}
                  rows={4}
                  placeholder="Describe the event..."
                  value={form.description}
                  onChange={(event) => setField('description', event.target.value)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-4">
                <p className="text-sm font-semibold text-slate-700">Event Banner / Media</p>
                <p className="mt-1 text-xs text-slate-500">Use an image URL for now. This block can later be connected to file storage.</p>
                <div className="mt-3 flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-white text-sm text-slate-400">
                  Event banner upload placeholder
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Venue Name" hint="Optional. We'll keep the current name if you leave it empty on edit.">
                  <input
                    className={inputCls()}
                    placeholder="e.g. Central Park Stage"
                    value={form.venueName}
                    onChange={(event) => setField('venueName', event.target.value)}
                  />
                </Field>

                <Field label="Venue Address *" error={errors.venueAddress}>
                  <input
                    className={inputCls(errors.venueAddress)}
                    placeholder="e.g. Central Park, New York, NY"
                    value={form.venueAddress}
                    onChange={(event) => setField('venueAddress', event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Start Date & Time *" error={errors.startTime}>
                  <input
                    type="datetime-local"
                    className={inputCls(errors.startTime)}
                    value={form.startTime}
                    onChange={(event) => setField('startTime', event.target.value)}
                  />
                </Field>

                <Field label="End Date & Time">
                  <input
                    type="datetime-local"
                    className={inputCls()}
                    value={form.endTime}
                    onChange={(event) => setField('endTime', event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Event Banner Image URL">
                <input
                  className={inputCls()}
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(event) => setField('imageUrl', event.target.value)}
                />
              </Field>

              {form.imageUrl && (
                <div className="h-36 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500">
                  <img
                    src={form.imageUrl}
                    alt="Event preview"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-2xl border border-violet-100 bg-white p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-700">Interactive Seat Layout Builder</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use the builder sidebar as the only source for Zone Name, Price, Rows, Seats per Row, shape, and layout coordinates.
                  </p>
                </div>

                {errors.seatLayout ? (
                  <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
                    {errors.seatLayout}
                  </p>
                ) : null}

                {Object.entries(errors)
                  .filter(([key]) => key.startsWith('layout_zone_'))
                  .map(([key, message]) => (
                    <p key={key} className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
                      {message}
                    </p>
                  ))}

                <SeatMapRenderer
                  isEditable
                  eventId={initial?.id || 'draft-event'}
                  initialLayout={form.seatLayout || {
                    zones: [],
                  }}
                  onChange={(payload) => setField('seatLayout', payload)}
                  onSave={(payload) => {
                    setField('seatLayout', payload);
                  }}
                />

                {form.seatLayout ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                    {getLayoutZones(form.seatLayout).length} zone(s) are attached to this event payload.
                  </p>
                ) : (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                    Add at least one zone to the canvas before creating the event.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Back
            </button>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || !isSeatLayoutReady}
              className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : initial ? 'Update Event' : 'Create Event'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
