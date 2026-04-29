export function EventHeader({ event }) {
  if (!event) return null;
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground">{event.name}</h1>
      <p className="text-muted-foreground mt-1">📍 {event.location}</p>
      <p className="text-muted-foreground">🕒 {new Date(event.startTime).toLocaleString()}</p>
    </div>
  );
}
