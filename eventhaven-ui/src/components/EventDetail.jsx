import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SeatSelector } from './SeatSelector';
import { WaitingRoom } from './WaitingRoom';
import { mapSeatLayoutToType, mapSeatsToType } from '@/lib/seat-types';
import { getEventById, getSeatLayout, getSeatMap } from '../services/eventService';

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [seatLayout, setSeatLayout] = useState(null);
  const [seatInventory, setSeatInventory] = useState([]);
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

        const [seatMapPayload, layoutPayload] = await Promise.all([
          getSeatMap(id).catch(() => []),
          getSeatLayout(id).catch(() => null),
        ]);

        if (!ignore) {
          const mappedLayout = mapSeatLayoutToType(layoutPayload);
          const mappedSeatMap = mapSeatsToType(Array.isArray(seatMapPayload) ? seatMapPayload : []);
          setEvent(eventPayload);
          setSeatLayout(mappedLayout.layout);
          setSeatInventory(mappedSeatMap.length ? mappedSeatMap : mappedLayout.seats);
        }
      } catch {
        if (!ignore) {
          setEvent(null);
          setSeatLayout(null);
          setSeatInventory([]);
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

  if (!isAdmitted) {
    return <WaitingRoom eventId={event.id || Number(id)} onAdmit={handleAdmit} />;
  }

  return (
    <SeatSelector
      eventId={event.id || Number(id)}
      event={{
        name: event.name,
        location: event.location || event.venue?.name || event.venue?.address,
        startTime: event.startTime,
        imageUrl: event.bannerUrl || event.imageUrl,
      }}
      initialLayout={seatLayout}
      initialSeats={seatInventory}
    />
  );
}
