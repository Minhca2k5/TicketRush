function statusClass(status) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Pending') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-red-50 text-red-700 ring-red-200';
}

export default function SalesTable({ orders, formatDateTime, formatCurrency }) {
  if (!orders.length) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        No ticket transactions found for this time range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full">
        <thead className="bg-slate-50/90">
          <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            <th className="px-6 py-4">Order ID</th>
            <th className="px-4 py-4">Event Name</th>
            <th className="px-4 py-4">Customer</th>
            <th className="px-4 py-4">Date</th>
            <th className="px-4 py-4">Amount</th>
            <th className="px-6 py-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-100 text-sm text-slate-600 transition hover:bg-slate-50/70">
              <td className="px-6 py-5 font-semibold text-slate-950">{order.orderId}</td>
              <td className="px-4 py-5">
                <p className="font-semibold text-slate-900">{order.eventName}</p>
                <p className="mt-1 text-xs text-slate-500">{order.ticketCount} tickets</p>
              </td>
              <td className="px-4 py-5">{order.customer}</td>
              <td className="px-4 py-5">{formatDateTime(order.createdAt)}</td>
              <td className="px-4 py-5 font-semibold text-slate-900">{formatCurrency(order.amount)}</td>
              <td className="px-6 py-5">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(order.status)}`}>
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
