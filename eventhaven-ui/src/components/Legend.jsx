const legendItems = [
  { label: 'Available', className: 'border-2 border-violet-400 bg-white' },
  { label: 'Booked', className: 'bg-slate-200 border border-slate-300' },
  { label: 'In Queue', className: 'bg-amber-300 border border-amber-400' },
  { label: 'Your Selection', className: 'bg-violet-600 border border-violet-600' },
];

export function Legend() {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">Seat Legend</h3>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
        {legendItems.map((item) => (
          <div key={item.label} className="inline-flex items-center gap-3 rounded-full bg-slate-50 px-4 py-2">
            <span className={`inline-block h-5 w-5 rounded-md ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
