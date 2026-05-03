import { useState, useEffect } from 'react';
import api from '../services/api';

const EMPTY_FORM = {
  name: '', description: '', startTime: '', endTime: '', imageUrl: '',
  organizer: '',
  venueMode: 'existing', // 'existing' | 'custom'
  venueId: '',
  customVenueName: '',
  customVenueAddress: '',
  // tiers: [{ zoneId, tierName, price, rows, seatsPerRow, rowPrefix }]
  tiers: [],
};

const inputCls = (err) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${err
    ? 'border-red-400 focus:ring-2 focus:ring-red-200'
    : 'border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100'}`;

const numCls = (err) =>
  `w-full px-2 py-2 rounded-lg border text-sm outline-none text-center transition ${err
    ? 'border-red-400'
    : 'border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100'}`;

const Field = ({ label, error, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    {children}
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

export default function EventFormModal({ initial, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial ? {
    ...EMPTY_FORM,
    ...initial,
    venueMode: 'existing',
    venueId: initial.venue?.id || '',
    tiers: initial.priceTiers?.map(t => ({
      zoneId: t.zoneId || '',
      tierName: t.tierName || '',
      price: t.price || '',
      rows: '',
      seatsPerRow: '',
      rowPrefix: 'R',
    })) || []
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [venues, setVenues] = useState([]);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    api.get('/venues').then(res => {
      setVenues(res.data?.data || res.data || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (form.venueMode === 'existing' && form.venueId) {
      api.get(`/venues/${form.venueId}/zones`).then(res => {
        setZones(res.data?.data || res.data || []);
      }).catch(console.error);
    } else {
      setZones([]);
    }
  }, [form.venueId, form.venueMode]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setTier = (i, k, v) => setForm(f => {
    const t = [...f.tiers]; t[i] = { ...t[i], [k]: v }; return { ...f, tiers: t };
  });
  const addTier = () => setForm(f => ({
    ...f, tiers: [...f.tiers, { zoneId: '', tierName: '', price: '', rows: '', seatsPerRow: '', rowPrefix: 'R' }]
  }));
  const removeTier = (i) => setForm(f => ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }));

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.name.trim()) e.name = 'Required';
      if (!form.organizer.trim()) e.organizer = 'Required';
    }
    if (step === 2) {
      if (form.venueMode === 'existing' && !form.venueId) e.venueId = 'Please select a venue';
      if (form.venueMode === 'custom' && !form.customVenueAddress.trim()) e.customVenueAddress = 'Please enter venue address';
      if (!form.startTime) e.startTime = 'Required';
    }
    if (step === 3) {
      // Validate tiers
      const zoneIds = new Set();
      form.tiers.forEach((t, i) => {
        if (!t.zoneId) e[`tier_${i}_zone`] = 'Please select a zone';
        else if (zoneIds.has(t.zoneId)) e[`tier_${i}_zone`] = 'This zone is already used in another tier';
        else zoneIds.add(t.zoneId);

        if (!t.tierName.trim()) e[`tier_${i}_name`] = 'Required';
        if (!t.price || parseFloat(t.price) <= 0) e[`tier_${i}_price`] = 'Invalid price';
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let venuePayload;
      let resolvedVenueId;

      if (form.venueMode === 'custom') {
        const venueName = form.customVenueName.trim() || 'Custom Venue';
        const venueAddress = form.customVenueAddress.trim();
        const created = await api.post('/venues', { name: venueName, address: venueAddress, totalCapacity: 0 });
        const newVenue = created.data?.data || created.data;
        resolvedVenueId = newVenue.id;
        venuePayload = { id: newVenue.id };
      } else {
        resolvedVenueId = form.venueId;
        venuePayload = { id: form.venueId };
      }

      const payload = {
        name: form.name,
        description: form.description,
        venue: venuePayload,
        startTime: form.startTime,
        endTime: form.endTime,
        bannerUrl: form.imageUrl,
        status: 'LIVE',
        priceTiers: form.tiers.filter(t => t.zoneId && t.tierName).map(t => ({
          zoneId: t.zoneId,
          tierName: t.tierName,
          price: t.price,
        }))
      };

      let savedEventId;
      if (initial?.id) {
        await api.put(`/events/${initial.id}`, payload);
        savedEventId = initial.id;
      } else {
        const res = await api.post('/events', payload);
        savedEventId = (res.data?.data || res.data)?.id;
      }

      // ── Configure seat grids for zones that have rows/seatsPerRow specified ──
      const seatConfigPromises = form.tiers
        .filter(t => t.zoneId && t.rows && t.seatsPerRow && parseInt(t.rows) > 0 && parseInt(t.seatsPerRow) > 0)
        .map(t => {
          // Find the venueId from the zone
          const zone = zones.find(z => z.id === t.zoneId);
          const venueId = zone?.venueId || resolvedVenueId;
          return api.post(`/venues/${venueId}/zones/${t.zoneId}/seats/configure`, {
            rows: parseInt(t.rows),
            seatsPerRow: parseInt(t.seatsPerRow),
            rowPrefix: t.rowPrefix || 'R',
          });
        });

      if (seatConfigPromises.length > 0) {
        await Promise.all(seatConfigPromises);
        // Refresh zones to update seat counts in UI
        const zonesRes = await api.get(`/venues/${resolvedVenueId}/zones`);
        setZones(zonesRes.data?.data || zonesRes.data || []);
      }

      onSaved(initial ? 'Event updated! Seats reconfigured ✓' : 'Event created! 🎉');
      onClose();
    } catch (err) {
      onSaved('Error: ' + (err.response?.data?.message || err.message), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{initial ? 'Edit Event' : 'Create New Event'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center transition text-lg leading-none">×</button>
        </div>

        {/* Step progress */}
        <div className="flex px-6 py-3 gap-2">
          {['Basic Info', 'Venue & Media', 'Pricing & Seats'].map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <div className={`h-1 rounded-full mb-1 ${step > i ? 'bg-violet-600' : 'bg-gray-200'}`} />
              <span className={`text-xs ${step === i + 1 ? 'text-violet-600 font-semibold' : 'text-gray-400'}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              <Field label="Event Title *" error={errors.name}>
                <input className={inputCls(errors.name)} placeholder="e.g. Summer Music Festival" value={form.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="Organizer *" error={errors.organizer}>
                <input className={inputCls(errors.organizer)} placeholder="Organizer name" value={form.organizer} onChange={e => set('organizer', e.target.value)} />
              </Field>
              <Field label="Description">
                <textarea className={inputCls()} rows={4} placeholder="Describe the event..." value={form.description} onChange={e => set('description', e.target.value)} />
              </Field>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              {/* Venue mode toggle */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                <button type="button" onClick={() => set('venueMode', 'existing')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${form.venueMode === 'existing' ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
                  📍 Choose Existing Venue
                </button>
                <button type="button" onClick={() => set('venueMode', 'custom')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${form.venueMode === 'custom' ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
                  ✏️ Enter Custom Address
                </button>
              </div>

              {form.venueMode === 'existing' && (
                <Field label="Select Venue *" error={errors.venueId} hint="Choose a venue that already has seat zones configured.">
                  <select className={inputCls(errors.venueId)} value={form.venueId} onChange={e => set('venueId', e.target.value)}>
                    <option value="">-- Choose Venue --</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>{v.name} — {v.address}</option>
                    ))}
                  </select>
                </Field>
              )}

              {form.venueMode === 'custom' && (
                <>
                  <Field label="Venue / Stage Name" hint="Optional. E.g. 'Stage B' or 'Central Park Lawn'">
                    <input className={inputCls()} placeholder="e.g. Sân khấu ngoài trời" value={form.customVenueName} onChange={e => set('customVenueName', e.target.value)} />
                  </Field>
                  <Field label="Full Address *" error={errors.customVenueAddress}>
                    <input className={inputCls(errors.customVenueAddress)} placeholder="e.g. 18 Lê Văn Lương, Thanh Xuân, Hà Nội" value={form.customVenueAddress} onChange={e => set('customVenueAddress', e.target.value)} />
                  </Field>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2 items-start">
                    <span className="text-base leading-none mt-0.5">⚠️</span>
                    <span>A new venue will be created. You can configure seat zones in Step 3.</span>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Start Date & Time *" error={errors.startTime}>
                  <input type="datetime-local" className={inputCls(errors.startTime)} value={form.startTime} onChange={e => set('startTime', e.target.value)} />
                </Field>
                <Field label="End Date & Time">
                  <input type="datetime-local" className={inputCls()} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
                </Field>
              </div>

              <Field label="Event Banner Image URL">
                <input className={inputCls()} placeholder="https://..." value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} />
              </Field>
              {form.imageUrl && (
                <div className="rounded-xl overflow-hidden h-32 bg-gradient-to-br from-violet-400 to-indigo-500">
                  <img src={form.imageUrl} alt="preview" className="h-full w-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700">Ticket Tiers & Seat Layout</p>
                <button onClick={addTier} className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition">+ Add Tier</button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-2">
                💡 Set <strong>Rows</strong> and <strong>Seats/Row</strong> to generate or replace the seat grid for that zone. Leave blank to keep existing seats.
              </div>

              {form.tiers.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No tiers yet. Click "+ Add Tier" to begin.</p>
              )}

              {form.tiers.map((tier, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600">Tier {i + 1}</p>
                    <button onClick={() => removeTier(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>

                  {/* Zone + Tier Name + Price row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Zone *</label>
                      {zones.length > 0 ? (
                        <select className={inputCls(errors[`tier_${i}_zone`])} value={tier.zoneId} onChange={e => setTier(i, 'zoneId', e.target.value)}>
                          <option value="">Select Zone</option>
                          {zones.map(z => (
                            <option key={z.id} value={z.id}>
                              {z.name}{z.seatCount != null ? ` (${z.seatCount})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input className={inputCls()} value="No zones" disabled />
                      )}
                      {errors[`tier_${i}_zone`] && <p className="text-[10px] text-red-500 mt-1">{errors[`tier_${i}_zone`]}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Tier Name *</label>
                      <input className={inputCls(errors[`tier_${i}_name`])} placeholder="VIP" value={tier.tierName} onChange={e => setTier(i, 'tierName', e.target.value)} />
                      {errors[`tier_${i}_name`] && <p className="text-[10px] text-red-500 mt-1">{errors[`tier_${i}_name`]}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Price (VND) *</label>
                      <input type="number" className={inputCls(errors[`tier_${i}_price`])} placeholder="500000" value={tier.price} onChange={e => setTier(i, 'price', e.target.value)} />
                      {errors[`tier_${i}_price`] && <p className="text-[10px] text-red-500 mt-1">{errors[`tier_${i}_price`]}</p>}
                    </div>
                  </div>

                  {/* Seat Grid Configuration */}
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">🪑 Seat Grid (optional — overwrites existing)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Rows</label>
                        <input
                          type="number"
                          min="1" max="30"
                          className={numCls()}
                          placeholder="e.g. 5"
                          value={tier.rows}
                          onChange={e => setTier(i, 'rows', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Seats / Row</label>
                        <input
                          type="number"
                          min="1" max="50"
                          className={numCls()}
                          placeholder="e.g. 10"
                          value={tier.seatsPerRow}
                          onChange={e => setTier(i, 'seatsPerRow', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Row Label</label>
                        <input
                          className={numCls()}
                          placeholder="R"
                          maxLength={3}
                          value={tier.rowPrefix}
                          onChange={e => setTier(i, 'rowPrefix', e.target.value)}
                        />
                      </div>
                    </div>
                    {tier.rows && tier.seatsPerRow && parseInt(tier.rows) > 0 && parseInt(tier.seatsPerRow) > 0 ? (
                      <p className="text-xs text-violet-600 mt-1.5 font-medium">
                        → Will create {parseInt(tier.rows) * parseInt(tier.seatsPerRow)} seats ({tier.rows} rows × {tier.seatsPerRow} per row)
                      </p>
                    ) : (
                      (() => {
                        const zone = zones.find(z => z.id === tier.zoneId);
                        if (zone && zone.seatCount === 0) {
                          return (
                            <p className="text-xs text-amber-600 mt-1.5 font-medium flex items-center gap-1">
                              ⚠️ This zone has 0 seats. Enter rows/seats above to create them.
                            </p>
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>
                </div>
              ))}

              {zones.length === 0 && form.venueMode === 'existing' && (
                <p className="text-xs text-red-500 mt-2">⚠️ No zones found for the selected venue. Add zones via venue management first.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          {step > 1 && <button onClick={back} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Back</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          {step < 3
            ? <button onClick={next} className="px-6 py-2.5 rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 transition shadow-sm">Next →</button>
            : <button onClick={submit} disabled={saving} className="px-6 py-2.5 rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 transition shadow-sm disabled:opacity-60">
              {saving ? 'Saving...' : initial ? 'Update Event' : 'Create Event'}
            </button>
          }
        </div>
      </div>
    </div>
  );
}
