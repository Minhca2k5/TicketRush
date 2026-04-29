export function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-green-500 rounded"></div>
        <span>Available</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-blue-500 rounded border-2 border-blue-700"></div>
        <span>Selected</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-red-500 rounded opacity-60"></div>
        <span>Sold</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-orange-500 rounded"></div>
        <span>Locked</span>
      </div>
    </div>
  );
}
