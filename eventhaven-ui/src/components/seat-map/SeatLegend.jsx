export default function SeatLegend() {
  const items = [
    { label: 'Available', cls: 'bg-white border-2 border-[#E9D5FF]' },
    { label: 'Selected', cls: 'bg-[#7C3AED] text-white shadow-[0_4px_10px_-2px_rgba(124,58,237,0.5)]' },
    { label: 'Locked/Waiting', cls: 'bg-yellow-100 border border-yellow-200' },
    { label: 'Sold', cls: 'bg-gray-200 border border-gray-300' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-t-sm rounded-b-none flex shrink-0 ${item.cls}`}></div>
          <span className="text-sm font-medium text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
