export function Stage() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/85 px-6 py-6 shadow-sm">
      <div className="absolute inset-x-16 top-5 h-16 rounded-full bg-violet-100/90 blur-3xl" />
      <div className="relative mx-auto max-w-2xl">
        <div className="rounded-[28px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-700 px-8 py-4 text-center text-base font-black uppercase tracking-[0.38em] text-white shadow-[0_20px_45px_rgba(15,23,42,0.32)]">
          Main Stage
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Premium viewing sections are arranged from front rows to general admission behind the center aisle.
        </p>
      </div>
    </div>
  );
}
