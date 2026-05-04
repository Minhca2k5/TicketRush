import { Compass, Globe2, Radio, Send, Ticket } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr] lg:px-8">
        <div>
          <h3 className="text-xl font-bold text-white">TicketRush</h3>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Premium ticketing for concerts, sports, and live entertainment with a smooth seat-selection experience.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Support</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>Help Center</li>
            <li>Contact Support</li>
            <li>Refund Policy</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Legal</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>Terms &amp; Conditions</li>
            <li>Privacy Policy</li>
            <li>Cookie Notice</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Newsletter</h4>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Get early access to trending events, premium drops, and limited-time offers.
          </p>
          <div className="mt-4 flex rounded-2xl border border-slate-800 bg-slate-900/80 p-1">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-2xl bg-transparent px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500">
              <Send size={16} />
              Subscribe
            </button>
          </div>
          <div className="mt-5 flex items-center gap-3 text-slate-400">
            {[Globe2, Radio, Compass, Ticket].map((Icon, index) => (
              <button
                key={index}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 transition hover:border-violet-500 hover:text-white"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
