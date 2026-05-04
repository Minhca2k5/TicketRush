import { CalendarDays, MapPin, Sparkles } from 'lucide-react';

export function EventHeader({ event }) {
  if (!event) return null;

  return (
    <section className="overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0_30px_70px_rgba(148,163,184,0.14)] backdrop-blur">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-8 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
            <Sparkles size={16} />
            Booking Flow
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">{event.name}</h1>
          <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-violet-500" />{new Date(event.startTime).toLocaleString()}</span>
            <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-violet-500" />{event.location}</span>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-7 text-slate-500">
            Select your seats, review your order, and complete checkout before your reservation timer expires.
          </p>
        </div>
        <div className="relative min-h-[260px]">
          <img src={event.imageUrl} alt={event.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
