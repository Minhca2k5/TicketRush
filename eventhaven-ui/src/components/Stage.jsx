export function Stage() {
  return (
    <div className="relative w-full flex justify-center mb-8">
      {/* Side lights effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[100px] border-r-[100px] border-b-[150px] border-l-transparent border-r-transparent border-b-primary/20"></div>
      {/* Stage */}
      <div className="relative z-10 px-8 py-3 bg-gradient-to-b from-primary to-primary/80 text-white text-lg font-bold tracking-wider rounded-b-lg shadow-lg border-t-4 border-primary/30">
        STAGE
      </div>
    </div>
  );
}
