import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import api from '../services/api';
import SeatMapRenderer from './seat-map/SeatMapRenderer';

const EMPTY_FORM = {
  name: '',
  description: '',
  organizer: '',
  category: '',
  status: 'PENDING',
  startTime: '',
  endTime: '',
  imageUrl: '',
  bannerFile: null,
  venueId: '',
  venueName: '',
  venueAddress: '',
  zones: [],
  tiers: [],
  seatLayout: null,
};

const categories = ['Concert', 'Sport', 'Theater', 'Conference', 'General'];
const eventStatuses = [
  { value: 'LIVE', label: 'Live', description: 'Visible and open for booking.' },
  { value: 'PENDING', label: 'Pending', description: 'Visible to customers, booking disabled.' },
  { value: 'DRAFT', label: 'Draft', description: 'Admin only.' },
];

function normalizeEditableStatus(status) {
  const normalized = String(status || 'PENDING').trim().toUpperCase();
  return eventStatuses.some((option) => option.value === normalized) ? normalized : 'PENDING';
}

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

function roundUpToNextMinute(date = new Date()) {
  const rounded = new Date(date);
  if (rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 1);
  }
  rounded.setSeconds(0, 0);
  return rounded;
}

function addMinutes(value, minutes) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() + minutes);
  return toDateTimeLocal(date);
}

function getDateTimeErrors(form, minStartTime) {
  const nextErrors = {};

  if (!form.startTime) {
    nextErrors.startTime = 'Start date & time is required';
  }

  if (form.startTime && form.endTime) {
    const start = new Date(form.startTime).getTime();
    const end = new Date(form.endTime).getTime();

    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      nextErrors.endTime = 'End date & time must be after the start date & time';
    }
  }

  return nextErrors;
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
    status: normalizeEditableStatus(initial.status),
    startTime: toDateTimeLocal(initial.startTime),
    endTime: toDateTimeLocal(initial.endTime),
    imageUrl: initial.bannerUrl || initial.imageUrl || '',
    bannerFile: null,
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

const ACCEPTED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_BANNER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_BANNER_SIZE = 5 * 1024 * 1024;

export default function EventFormModal({ initial, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => normalizeInitial(initial));
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState(() => normalizeInitial(initial).imageUrl || '');
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [uploadToast, setUploadToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const bannerInputRef = useRef(null);
  const bannerObjectUrlRef = useRef('');
  const minStartTime = toDateTimeLocal(roundUpToNextMinute());
  const minEndTime = form.startTime ? addMinutes(form.startTime, 1) : minStartTime;
  const timeErrors = useMemo(() => getDateTimeErrors(form, minStartTime), [form, minStartTime]);
  const hasTimeErrors = Object.keys(timeErrors).length > 0;
  const startTimeError = errors.startTime || timeErrors.startTime;
  const endTimeError = errors.endTime || timeErrors.endTime;

  useEffect(() => {
    if (bannerObjectUrlRef.current) {
      URL.revokeObjectURL(bannerObjectUrlRef.current);
      bannerObjectUrlRef.current = '';
    }
    setForm(normalizeInitial(initial));
    setBannerPreviewUrl(normalizeInitial(initial).imageUrl || '');
    setStep(1);
    setErrors({});
  }, [initial]);

  useEffect(() => {
    if (!uploadToast) return undefined;
    const timer = window.setTimeout(() => setUploadToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [uploadToast]);

  useEffect(() => () => {
    if (bannerObjectUrlRef.current) {
      URL.revokeObjectURL(bannerObjectUrlRef.current);
    }
  }, []);

  const setField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'startTime' && next.endTime) {
        const start = new Date(value).getTime();
        const end = new Date(next.endTime).getTime();

        if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
          next.endTime = '';
        }
      }

      return next;
    });

    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      if (field === 'startTime') delete nextErrors.endTime;
      return nextErrors;
    });
  };

  const showUploadError = (message) => {
    setErrors((current) => ({ ...current, bannerFile: message }));
    setUploadToast({ type: 'warning', message });
  };

  const handleBannerFile = (file) => {
    if (!file) return;

    const extension = String(file.name || '').split('.').pop()?.toLowerCase();
    const hasValidType = !file.type || ACCEPTED_BANNER_TYPES.includes(file.type);
    const hasValidExtension = ACCEPTED_BANNER_EXTENSIONS.includes(extension);

    if (!hasValidType || !hasValidExtension) {
      showUploadError('Banner image must be a JPG, PNG, JPEG, or WEBP file.');
      return;
    }

    if (file.size > MAX_BANNER_SIZE) {
      showUploadError('Banner image must be 5MB or smaller.');
      return;
    }

    if (bannerObjectUrlRef.current) {
      URL.revokeObjectURL(bannerObjectUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    bannerObjectUrlRef.current = previewUrl;
    setBannerPreviewUrl(previewUrl);
    setField('bannerFile', file);
    setField('imageUrl', '');
    setUploadToast(null);
  };

  const openBannerPicker = () => {
    bannerInputRef.current?.click();
  };

  const handleBannerDrop = (event) => {
    event.preventDefault();
    setIsDraggingBanner(false);
    handleBannerFile(event.dataTransfer.files?.[0]);
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
      if (!form.status.trim()) nextErrors.status = 'Status is required';
    }

    if (step === 2) {
      if (!form.venueAddress.trim()) nextErrors.venueAddress = 'Venue address is required';
    }

    if (step >= 2) {
      Object.assign(nextErrors, getDateTimeErrors(form, toDateTimeLocal(roundUpToNextMinute())));
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
        status: form.status || 'PENDING',
        description: form.description.trim() || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        imageUrl: form.bannerFile ? null : form.imageUrl.trim() || null,
        bannerUrl: form.bannerFile ? null : form.imageUrl.trim() || null,
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

      let response;
      if (form.bannerFile) {
        const multipartPayload = new FormData();
        multipartPayload.append('payload', JSON.stringify(payload));
        multipartPayload.append('bannerFile', form.bannerFile);
        response = initial?.id
          ? await api.put(`/events/${initial.id}`, multipartPayload)
          : await api.post('/events', multipartPayload);
      } else {
        response = initial?.id
          ? await api.put(`/events/${initial.id}`, payload)
          : await api.post('/events', payload);
      }

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
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm ${step === 3 ? 'p-2' : 'p-4'}`}>
      <div className={`relative flex max-h-[98vh] w-full flex-col rounded-[28px] bg-white shadow-2xl ${step === 3 ? 'max-w-[99vw]' : 'max-w-3xl'}`}>
        {uploadToast ? (
          <div className="absolute right-6 top-20 z-10 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 shadow-lg">
            {uploadToast.message}
          </div>
        ) : null}
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

        <div className={`flex-1 space-y-4 overflow-y-auto ${step === 3 ? 'px-3 py-3' : 'px-6 py-4'}`}>
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

              <Field label="Status *" error={errors.status} hint="Live can sell tickets. Pending is visible but locked. Draft is admin-only.">
                <select
                  className={inputCls(errors.status)}
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value)}
                >
                  {eventStatuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {eventStatuses.find((status) => status.value === form.status)?.description}
                </p>
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
                <Field label="Start Date & Time *" error={startTimeError}>
                  <input
                    type="datetime-local"
                    className={inputCls(startTimeError)}
                    value={form.startTime}
                    onChange={(event) => setField('startTime', event.target.value)}
                  />
                </Field>

                <Field label="End Date & Time" error={endTimeError}>
                  <input
                    type="datetime-local"
                    className={inputCls(endTimeError)}
                    value={form.endTime}
                    onChange={(event) => setField('endTime', event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Event Banner Image" error={errors.bannerFile} hint="JPG, PNG, JPEG, or WEBP. Maximum 5MB.">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    handleBannerFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={openBannerPicker}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingBanner(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingBanner(true);
                  }}
                  onDragLeave={() => setIsDraggingBanner(false)}
                  onDrop={handleBannerDrop}
                  className={`flex min-h-[132px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${
                    isDraggingBanner
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-slate-200 bg-slate-50/80 hover:border-violet-300 hover:bg-violet-50/60'
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
                    <UploadCloud size={24} />
                  </span>
                  <span className="mt-3 text-sm font-bold text-slate-800">
                    Kéo thả ảnh banner vào đây hoặc click để chọn file từ máy tính
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    {form.bannerFile ? form.bannerFile.name : 'Recommended: wide banner image, under 5MB'}
                  </span>
                </button>
              </Field>

              {bannerPreviewUrl ? (
                <div className="h-36 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500">
                  <img
                    src={bannerPreviewUrl}
                    alt="Event preview"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-400">
                  <ImageIcon size={18} className="mr-2" />
                  Banner preview will appear here
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-2xl border border-violet-100 bg-white p-3">
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
              disabled={saving || !isSeatLayoutReady || hasTimeErrors}
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
