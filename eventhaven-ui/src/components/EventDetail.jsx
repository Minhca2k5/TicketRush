import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare, Star } from 'lucide-react';
import { SeatSelector } from './SeatSelector';
import { WaitingRoom } from './WaitingRoom';
import { mapSeatLayoutToType, mapSeatsToType } from '@/lib/seat-types';
import { getEventById, getEventReviews, getSeatLayout, getSeatMap, submitEventReview } from '../services/eventService';
import { getProfile } from '../services/authService';
import { isEventPast, isEventPending } from '../lib/event-status';
import { getAccountHolderId } from '../lib/holder';

function RatingStars({ value, onChange, interactive = false }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange(star)}
          className={interactive ? 'rounded-full p-1 transition hover:bg-amber-50' : 'cursor-default p-1'}
          aria-label={`${star} star`}
        >
          <Star size={20} className={star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
        </button>
      ))}
    </div>
  );
}

function EventReviewsPanel({ event, onReviewSaved }) {
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getEventReviews(event.id).catch(() => []),
      getProfile().catch(() => null),
    ]).then(([reviewPayload, profilePayload]) => {
      if (ignore) return;
      setReviews(Array.isArray(reviewPayload) ? reviewPayload : []);
      setProfile(profilePayload);
    }).finally(() => {
      if (!ignore) setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [event.id]);

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    const userId = getAccountHolderId(profile);
    if (!userId) {
      setMessage('Please sign in before reviewing this event.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const savedReview = await submitEventReview(event.id, {
        userId,
        userName: profile?.username || profile?.email || 'TicketRush customer',
        rating,
        comment,
      });
      setReviews((current) => [savedReview, ...current.filter((review) => review.userId !== userId)]);
      setComment('');
      setMessage('Review saved.');
      onReviewSaved?.();
    } catch {
      setMessage('Unable to save review right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto mt-8 max-w-4xl px-4 pb-16">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Event Reviews</h2>
            <p className="mt-1 text-sm text-slate-500">
              {Number(event.averageRating || 0).toFixed(1)} average from {event.reviewCount || reviews.length} review(s)
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            {Number(event.averageRating || 0).toFixed(1)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">Your rating</p>
              <RatingStars value={rating} onChange={setRating} interactive />
            </div>
            <textarea
              value={comment}
              onChange={(inputEvent) => setComment(inputEvent.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Share your experience..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">{message}</p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                <MessageSquare size={16} />
                {saving ? 'Saving...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 grid gap-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading reviews...</p>
          ) : reviews.length ? (
            reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{review.userName || 'TicketRush customer'}</p>
                    <p className="text-xs text-slate-400">
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <RatingStars value={review.rating || 0} />
                </div>
                {review.comment ? <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p> : null}
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
              No reviews yet. Be the first attendee to leave feedback.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [seatLayout, setSeatLayout] = useState(null);
  const [seatInventory, setSeatInventory] = useState([]);
  const [rawSeatInventory, setRawSeatInventory] = useState([]);
  const [coordinateLayout, setCoordinateLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmitted, setIsAdmitted] = useState(() => (
    window.sessionStorage.getItem(`ticketrush-admitted-${id}`) === 'true'
  ));

  const handleAdmit = useCallback(() => {
    window.sessionStorage.setItem(`ticketrush-admitted-${id}`, 'true');
    setIsAdmitted(true);
  }, [id]);

  useEffect(() => {
    setIsAdmitted(window.sessionStorage.getItem(`ticketrush-admitted-${id}`) === 'true');
  }, [id]);

  useEffect(() => {
    let ignore = false;

    const load = async (isInitialLoad = false) => {
      try {
        const eventPayload = await getEventById(id);
        const shouldLoadSeatExperience = !isEventPast(eventPayload);

        const [seatMapPayload, layoutPayload] = shouldLoadSeatExperience
          ? await Promise.all([
              getSeatMap(id).catch(() => []),
              getSeatLayout(id).catch(() => null),
            ])
          : [[], null];

        if (!ignore) {
          const mappedLayout = mapSeatLayoutToType(layoutPayload);
          const mappedSeatMap = mapSeatsToType(Array.isArray(seatMapPayload) ? seatMapPayload : []);
          setEvent(eventPayload);
          setSeatLayout(mappedLayout.layout);
          setSeatInventory(mappedSeatMap.length ? mappedSeatMap : mappedLayout.seats);
          setRawSeatInventory(Array.isArray(seatMapPayload) ? seatMapPayload : []);
          setCoordinateLayout(eventPayload?.seatLayout || null);
        }
      } catch {
        if (!ignore) {
          setEvent(null);
          setSeatLayout(null);
          setSeatInventory([]);
          setRawSeatInventory([]);
          setCoordinateLayout(null);
        }
      } finally {
        if (!ignore && isInitialLoad) {
          setLoading(false);
        }
      }
    };

    load(true);

    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return <div className="px-4 py-20 text-center text-slate-500">Loading booking experience...</div>;
  }

  if (!event) {
    return <div className="px-4 py-20 text-center text-red-500">Unable to load event.</div>;
  }

  if (isEventPast(event)) {
    return (
      <div className="bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 pt-20 text-center">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
              <Star size={16} className="fill-amber-400 text-amber-400" />
              {Number(event.averageRating || 0).toFixed(1)} from {event.reviewCount || 0} review(s)
            </div>
            <h1 className="text-2xl font-black text-slate-950">Event has ended</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Booking is closed for this event. Attendees can still leave a rating and review.
            </p>
          </div>
        </div>
        <EventReviewsPanel
          event={event}
          onReviewSaved={async () => {
            const refreshed = await getEventById(id).catch(() => null);
            if (refreshed) setEvent(refreshed);
          }}
        />
      </div>
    );
  }

  const pendingPreview = isEventPending(event);

  if (!pendingPreview && !isAdmitted) {
    return <WaitingRoom eventId={event.id || Number(id)} onAdmit={handleAdmit} />;
  }

  return (
    <SeatSelector
      eventId={event.id || Number(id)}
      isPending={pendingPreview}
      event={{
        name: event.name,
        location: event.location || event.venue?.name || event.venue?.address,
        startTime: event.startTime,
        imageUrl: event.bannerUrl || event.imageUrl,
        averageRating: event.averageRating,
        reviewCount: event.reviewCount,
        status: event.status,
      }}
      initialLayout={seatLayout}
      initialSeats={seatInventory}
      initialRawSeats={rawSeatInventory}
      initialCoordinateLayout={coordinateLayout}
    />
  );
}
