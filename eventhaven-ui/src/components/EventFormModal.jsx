import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

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
};

const categories = ['Concert', 'Sport', 'Theater', 'Conference', 'General'];

const inputCls = (error) =>
  `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
    error
      ? 'border-red-400 focus:ring-2 focus:ring-red-200'
      : 'border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  }`;

const smallInputCls = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
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

function createZoneState(zone = {}) {
  return {
    key: zone.key || (zone.id ? `zone-${zone.id}` : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    id: zone.id || null,
    name: zone.name || '',
    description: zone.description || '',
    rows: zone.rows ?? '',
    seatsPerRow: zone.seatsPerRow ?? '',
    rowPrefix: zone.rowPrefix || 'A',
    seatCount: zone.seatCount || 0,
  };
}

function createTierState(tier = {}, zones = []) {
  const matchedZone = zones.find((zone) => zone.id && tier.zoneId && String(zone.id) === String(tier.zoneId))
    || zones.find((zone) => zone.name && tier.zoneName && zone.name.toLowerCase() === tier.zoneName.toLowerCase());

  return {
    key: tier.key || `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    zoneKey: matchedZone?.key || '',
    tierName: tier.tierName || '',
    price: tier.price != null ? String(tier.price) : '',
  };
}

function normalizeInitial(initial) {
  if (!initial) {
    return {
      ...EMPTY_FORM,
      zones: [createZoneState()],
      tiers: [createTierState()],
    };
  }

  const normalizedZones = (initial.zones?.length ? initial.zones : []).map((zone) => createZoneState(zone));
  const seedZones = normalizedZones.length ? [...normalizedZones] : [];
  const rawTiers = initial.priceTiers?.length ? initial.priceTiers : [];

  if (!seedZones.length && rawTiers.length) {
    rawTiers.forEach((tier) => {
      if (tier.zoneName && !seedZones.some((zone) => zone.name.toLowerCase() === tier.zoneName.toLowerCase())) {
        seedZones.push(createZoneState({ name: tier.zoneName, description: '', rowPrefix: 'A' }));
      }
    });
  }

  const finalZones = seedZones.length ? seedZones : [createZoneState()];
  const finalTiers = rawTiers.length ? rawTiers.map((tier) => createTierState(tier, finalZones)) : [createTierState({}, finalZones)];

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
    zones: finalZones,
    tiers: finalTiers,
  };
}

function formatSeatProjection(zone) {
  const rows = Number(zone.rows || 0);
  const seatsPerRow = Number(zone.seatsPerRow || 0);
  if (!rows || !seatsPerRow) return null;
  return rows * seatsPerRow;
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

  const zoneOptions = useMemo(
    () => form.zones.filter((zone) => zone.name.trim()),
    [form.zones]
  );

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateZone = (zoneKey, field, value) => {
    setForm((current) => ({
      ...current,
      zones: current.zones.map((zone) => (zone.key === zoneKey ? { ...zone, [field]: value } : zone)),
    }));
  };

  const addZone = () => {
    setForm((current) => ({ ...current, zones: [...current.zones, createZoneState()] }));
  };

  const removeZone = (zoneKey) => {
    setForm((current) => ({
      ...current,
      zones: current.zones.filter((zone) => zone.key !== zoneKey),
      tiers: current.tiers.map((tier) => (tier.zoneKey === zoneKey ? { ...tier, zoneKey: '' } : tier)),
    }));
  };

  const updateTier = (tierKey, field, value) => {
    setForm((current) => ({
      ...current,
      tiers: current.tiers.map((tier) => (tier.key === tierKey ? { ...tier, [field]: value } : tier)),
    }));
  };

  const addTier = () => {
    setForm((current) => ({ ...current, tiers: [...current.tiers, createTierState({}, current.zones)] }));
  };

  const removeTier = (tierKey) => {
    setForm((current) => ({
      ...current,
      tiers: current.tiers.filter((tier) => tier.key !== tierKey),
    }));
  };

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
      const zoneNames = new Set();
      const tierZoneKeys = new Set();

      if (!form.zones.length) {
        nextErrors.zones = 'Add at least one zone';
      }

      form.zones.forEach((zone, index) => {
        const trimmedName = zone.name.trim();
        if (!trimmedName) {
          nextErrors[`zone_${zone.key}_name`] = 'Zone name is required';
          return;
        }

        const normalizedName = trimmedName.toLowerCase();
        if (zoneNames.has(normalizedName)) {
          nextErrors[`zone_${zone.key}_name`] = 'Zone name must be unique';
        }
        zoneNames.add(normalizedName);

        const rows = zone.rows === '' ? null : Number(zone.rows);
        const seatsPerRow = zone.seatsPerRow === '' ? null : Number(zone.seatsPerRow);

        if ((rows && !seatsPerRow) || (!rows && seatsPerRow)) {
          nextErrors[`zone_${zone.key}_layout`] = 'Rows and seats per row must be filled together';
        }

        if (rows != null && (Number.isNaN(rows) || rows < 1 || rows > 30)) {
          nextErrors[`zone_${zone.key}_rows`] = 'Rows must be between 1 and 30';
        }

        if (seatsPerRow != null && (Number.isNaN(seatsPerRow) || seatsPerRow < 1 || seatsPerRow > 50)) {
          nextErrors[`zone_${zone.key}_seats`] = 'Seats per row must be between 1 and 50';
        }

        if (!zone.rowPrefix.trim()) {
          nextErrors[`zone_${zone.key}_prefix`] = 'Starting row label is required';
        }

        if (index === 0 && !form.tiers.length) {
          nextErrors.tiers = 'Add at least one ticket tier';
        }
      });

      form.tiers.forEach((tier) => {
        if (!tier.zoneKey) {
          nextErrors[`tier_${tier.key}_zone`] = 'Select a zone';
        } else if (tierZoneKeys.has(tier.zoneKey)) {
          nextErrors[`tier_${tier.key}_zone`] = 'Each zone can only be used once';
        } else {
          tierZoneKeys.add(tier.zoneKey);
        }

        if (!tier.tierName.trim()) {
          nextErrors[`tier_${tier.key}_name`] = 'Tier name is required';
        }

        const price = Number(tier.price);
        if (!tier.price || Number.isNaN(price) || price <= 0) {
          nextErrors[`tier_${tier.key}_price`] = 'Price must be greater than 0';
        }
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
      const totalCapacity = form.zones.reduce((sum, zone) => sum + (formatSeatProjection(zone) || 0), 0);

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
        zones: form.zones
          .filter((zone) => zone.name.trim())
          .map((zone) => ({
            id: zone.id || null,
            name: zone.name.trim(),
            description: zone.description.trim() || null,
            rows: zone.rows === '' ? null : Number(zone.rows),
            seatsPerRow: zone.seatsPerRow === '' ? null : Number(zone.seatsPerRow),
            rowPrefix: zone.rowPrefix.trim() || 'A',
            seatCount: formatSeatProjection(zone) || zone.seatCount || 0,
          })),
        priceTiers: form.tiers.map((tier) => {
          const linkedZone = form.zones.find((zone) => zone.key === tier.zoneKey);
          return {
            zoneId: linkedZone?.id || null,
            zoneName: linkedZone?.name?.trim() || '',
            tierName: tier.tierName.trim(),
            price: Number(tier.price),
          };
        }),
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
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[28px] bg-white shadow-2xl">
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
              <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Seat Zones</p>
                    <p className="mt-1 text-xs text-slate-500">Create seating sections here. Each zone can generate its own seat grid automatically.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addZone}
                    className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    + Add Zone
                  </button>
                </div>

                {errors.zones && <p className="mt-3 text-xs text-red-500">{errors.zones}</p>}

                <div className="mt-4 space-y-4">
                  {form.zones.map((zone, index) => {
                    const seatProjection = formatSeatProjection(zone);
                    return (
                      <div key={zone.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-700">Zone {index + 1}</p>
                          {form.zones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeZone(zone.key)}
                              className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Field label="Zone Name *" error={errors[`zone_${zone.key}_name`]}>
                            <input
                              className={smallInputCls(errors[`zone_${zone.key}_name`])}
                              placeholder="e.g. VIP"
                              value={zone.name}
                              onChange={(event) => updateZone(zone.key, 'name', event.target.value)}
                            />
                          </Field>

                          <Field label="Description">
                            <input
                              className={smallInputCls()}
                              placeholder="Front section, balcony, standing area..."
                              value={zone.description}
                              onChange={(event) => updateZone(zone.key, 'description', event.target.value)}
                            />
                          </Field>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <Field label="Rows" error={errors[`zone_${zone.key}_rows`] || errors[`zone_${zone.key}_layout`]}>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              className={smallInputCls(errors[`zone_${zone.key}_rows`] || errors[`zone_${zone.key}_layout`])}
                              value={zone.rows}
                              onChange={(event) => updateZone(zone.key, 'rows', event.target.value)}
                            />
                          </Field>

                          <Field label="Seats / Row" error={errors[`zone_${zone.key}_seats`] || errors[`zone_${zone.key}_layout`]}>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              className={smallInputCls(errors[`zone_${zone.key}_seats`] || errors[`zone_${zone.key}_layout`])}
                              value={zone.seatsPerRow}
                              onChange={(event) => updateZone(zone.key, 'seatsPerRow', event.target.value)}
                            />
                          </Field>

                          <Field label="Starting Row Label" error={errors[`zone_${zone.key}_prefix`]}>
                            <input
                              className={smallInputCls(errors[`zone_${zone.key}_prefix`])}
                              maxLength={3}
                              value={zone.rowPrefix}
                              onChange={(event) => updateZone(zone.key, 'rowPrefix', event.target.value)}
                            />
                          </Field>
                        </div>

                        {seatProjection ? (
                          <p className="mt-2 text-xs font-semibold text-violet-600">
                            This zone will generate {seatProjection} seats automatically.
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">
                            Leave Rows and Seats / Row blank if you only want to keep the zone for later.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Ticket Tiers</p>
                    <p className="mt-1 text-xs text-slate-500">Attach each tier to a zone so the backend can map pricing and seat generation correctly.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addTier}
                    className="rounded-xl border border-violet-200 bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    + Add Tier
                  </button>
                </div>

                {errors.tiers && <p className="mt-3 text-xs text-red-500">{errors.tiers}</p>}

                <div className="mt-4 space-y-4">
                  {form.tiers.map((tier, index) => (
                    <div key={tier.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-700">Tier {index + 1}</p>
                        {form.tiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTier(tier.key)}
                            className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Field label="Zone *" error={errors[`tier_${tier.key}_zone`]}>
                          <select
                            className={smallInputCls(errors[`tier_${tier.key}_zone`])}
                            value={tier.zoneKey}
                            onChange={(event) => updateTier(tier.key, 'zoneKey', event.target.value)}
                          >
                            <option value="">Select zone</option>
                            {zoneOptions.map((zone) => (
                              <option key={zone.key} value={zone.key}>
                                {zone.name}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Tier Name *" error={errors[`tier_${tier.key}_name`]}>
                          <input
                            className={smallInputCls(errors[`tier_${tier.key}_name`])}
                            placeholder="e.g. VIP"
                            value={tier.tierName}
                            onChange={(event) => updateTier(tier.key, 'tierName', event.target.value)}
                          />
                        </Field>

                        <Field label="Price *" error={errors[`tier_${tier.key}_price`]}>
                          <input
                            type="number"
                            min="1"
                            className={smallInputCls(errors[`tier_${tier.key}_price`])}
                            placeholder="250"
                            value={tier.price}
                            onChange={(event) => updateTier(tier.key, 'price', event.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
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
              disabled={saving}
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
