import SeatLayoutBuilder from '../admin/SeatLayoutBuilder';
import CustomerSeatMapCanvas from './CustomerSeatMapCanvas';

export default function SeatMapRenderer({
  isEditable = false,
  eventId,
  initialLayout,
  layout,
  liveSeats = [],
  selectedSeats = [],
  readOnly = false,
  canvasTheme = 'light',
  fillViewport = false,
  className = '',
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
      readOnly={readOnly}
      canvasTheme={canvasTheme}
      fillViewport={fillViewport}
      className={className}
      onToggleSeat={onToggleSeat}
    />
  );
}
