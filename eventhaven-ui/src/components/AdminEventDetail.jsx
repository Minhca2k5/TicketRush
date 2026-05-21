import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, MessageSquare, Star, Ticket, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import AdminSeatMapPreview from './admin/AdminSeatMapPreview';
import SeatMapRenderer from './seat-map/SeatMapRenderer';
import { getAdminEventStatus } from '../lib/event-status';

const fallbackEvent = {
  id: 1,
  name: 'Summer Music Festival 2024',
  category: 'Concert',
  organizer: 'Aurora Entertainment',
  description: 'Outdoor live concert with premium seating and premium access control.',
  location: 'Central Park, NYC',
  startTime: '2026-07-15T19:30:00',
  endTime: '2026-07-15T23:00:00',
  imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80',
  status: 'Live',
  venue: { name: 'Central Park Stage', address: 'Central Park, NYC', totalCapacity: 12000 },
  priceTiers: [
    { tierName: 'VIP', price: 250 },
    { tierName: 'General Admission', price: 99 },
  ],
  seats: [],
};

function formatDateTime(value) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusClass(status) {
  if (status === 'Live') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Pending') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'Past') return 'bg-slate-100 text-slate-500 ring-slate-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function AdminEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const [eventResponse, reviewsResponse] = await Promise.all([
          api.get(`/events/${id}?includeDraft=true`),
          api.get(`/events/${id}/reviews`).catch(() => ({ data: { data: [] } })),
        ]);
        const payload = eventResponse.data?.data || eventResponse.data;
        const reviewPayload = reviewsResponse.data?.data || reviewsResponse.data || [];
        if (!ignore) {
          setEvent(payload);
          setReviews(Array.isArray(reviewPayload) ? reviewPayload : []);
        }
      } catch {
        if (!ignore) {
          setEvent({ ...fallbackEvent, id: Number(id) || fallbackEvent.id });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  const summary = useMemo(() => {
    if (!event) return null;
    return {
      venueLabel: event.venue?.name || event.location || 'Venue TBD',
      address: event.venue?.address || event.location || 'Location TBD',
      capacity: event.venue?.totalCapacity || event.seats?.length || 0,
      tiers: event.priceTiers?.length || 0,
    };
  }, [event]);

  const hasCoordinateLayout = event?.seatLayout?.zones?.length > 0;
  const eventStatus = getAdminEventStatus(event);

  if (loading) {
    return <div className="px-8 py-16 text-sm text-slate-500">Loading event details...</div>;
  }

  if (!event) {
    return <div className="px-8 py-16 text-sm text-red-500">Unable to load event details.</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-6 py-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate('/admin/events')}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
      >
        <ArrowLeft size={16} />
        Back To Events
      </button>

      <section className="mt-6 overflow-hidden rounded-[32px] border border-[#dfe7f2] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 lg:p-10">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(eventStatus)}`}>
              {eventStatus}
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950">{event.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              {event.description || 'No description available for this event yet.'}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CalendarDays size={16} className="text-violet-500" />
                  Schedule
                </div>
                <p className="mt-3 text-sm text-slate-600">Starts: {formatDateTime(event.startTime)}</p>
                <p className="mt-1 text-sm text-slate-600">Ends: {formatDateTime(event.endTime)}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MapPin size={16} className="text-violet-500" />
                  Venue
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">{summary.venueLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{summary.address}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UserRound size={16} className="text-violet-500" />
                  Organizer
                </div>
                <p className="mt-3 text-sm text-slate-700">{event.organizer || 'TicketRush Organizer'}</p>
                <p className="mt-1 text-sm text-slate-500">Category: {event.category || 'General'}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Ticket size={16} className="text-violet-500" />
                  Ticket Setup
                </div>
                <p className="mt-3 text-sm text-slate-700">Price tiers: {summary.tiers}</p>
                <p className="mt-1 text-sm text-slate-500">Capacity: {summary.capacity}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 md:col-span-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  Reviews
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  Average rating: {Number(event.averageRating || 0).toFixed(1)} / 5
                </p>
                <p className="mt-1 text-sm text-slate-500">Total reviews: {event.reviewCount || reviews.length}</p>
              </div>
            </div>
          </div>

          <div className="min-h-[320px] bg-slate-100">
            <img
              src={event.imageUrl || fallbackEvent.imageUrl}
              alt={event.name}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] border border-[#dfe7f2] bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Review Summary</h2>
            <p className="mt-2 text-sm text-slate-500">Latest attendee feedback for this event.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            {Number(event.averageRating || 0).toFixed(1)}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {reviews.length ? (
            reviews.slice(0, 5).map((review) => (
              <article key={review.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MessageSquare size={16} className="text-violet-500" />
                    {review.userName || 'TicketRush customer'}
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm font-bold text-amber-700">
                    <Star size={15} className="fill-amber-400 text-amber-400" />
                    {review.rating}/5
                  </div>
                </div>
                {review.comment ? <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p> : null}
              </article>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
              No reviews have been submitted yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[32px] border border-[#dfe7f2] bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Pricing Overview</h2>
            <p className="mt-2 text-sm text-slate-500">Current ticket tiers configured for this event.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(event.priceTiers?.length ? event.priceTiers : fallbackEvent.priceTiers).map((tier, index) => (
            <div key={`${tier.tierName}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{tier.tierName}</p>
              <p className="mt-3 text-3xl font-black text-slate-950">${Number(tier.price || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        {hasCoordinateLayout ? (
          <div className="rounded-[32px] border border-[#dfe7f2] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
            <div className="mb-4">
              <h2 className="text-2xl font-black text-slate-950">Seat Layout Preview</h2>
              <p className="mt-2 text-sm text-slate-500">
                View mode uses the same coordinate-based layout that customers see during booking.
              </p>
            </div>
            <SeatMapRenderer
              isEditable={false}
              eventId={id}
              layout={event.seatLayout}
              liveSeats={event.seats || []}
              selectedSeats={[]}
            />
          </div>
        ) : null}
      </section>

      {!hasCoordinateLayout ? <AdminSeatMapPreview eventId={id} /> : null}
    </div>
  );
}
