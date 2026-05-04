export default function RevenueTrendChart({ data, formatCurrency }) {
  const peak = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Revenue Trend</h2>
          <p className="mt-2 text-sm text-slate-500">Daily revenue performance across the selected time range.</p>
        </div>
        <p className="text-sm font-semibold text-violet-600">
          Peak day: {formatCurrency(peak)}
        </p>
      </div>

      <div className="mt-6">
        <div className="flex h-[260px] items-end gap-3 overflow-x-auto pb-2">
          {data.map((point) => (
            <div key={point.label} className="flex min-w-[72px] flex-1 flex-col items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">{formatCurrency(point.value)}</span>
              <div className="flex h-[180px] w-full items-end rounded-[24px] bg-slate-50 px-2 py-2">
                <div
                  className="w-full rounded-[18px] bg-gradient-to-t from-violet-600 via-violet-500 to-fuchsia-400 shadow-[0_10px_18px_rgba(139,92,246,0.25)]"
                  style={{ height: `${Math.max(12, Math.round((point.value / peak) * 100))}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
