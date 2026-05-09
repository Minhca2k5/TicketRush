import SeatLayoutBuilder from '../admin/SeatLayoutBuilder';
import CustomerSeatMapCanvas from './CustomerSeatMapCanvas';

export default function SeatMapRenderer({
  isEditable = false,
  eventId,
  initialLayout,
  layout,
  liveSeats = [],
  selectedSeats = [],
  onToggleSeat = () => {},
  onChange,
  onSave,
}) {
  if (isEditable) {
    return (
      <SeatLayoutBuilder
        eventId={eventId}
        initialLayout={initialLayout || layout}
        onChange={onChange}
        onSave={onSave}
      />
    );
  }

  return (
    <CustomerSeatMapCanvas
      layout={layout}
      liveSeats={liveSeats}
      selectedSeats={selectedSeats}
      onToggleSeat={onToggleSeat}
    />
  );
}
