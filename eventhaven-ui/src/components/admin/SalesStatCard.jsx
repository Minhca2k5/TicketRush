export default function SalesStatCard({ label, value, hint, icon: Icon, surface, iconBg }) {
  return (
    <article className={`rounded-[28px] border border-white/80 bg-gradient-to-br ${surface} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-4 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-3 text-xs font-semibold text-slate-600">{hint}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}
