import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Settings, ShieldCheck, Ticket, UserCircle2 } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { getAuthToken } from '../lib/auth';

const navItems = [
  { label: 'Home', to: '/' },
];

export function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const token = getAuthToken();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLandingPage = location.pathname === '/';
  const showNavLinks = !isLandingPage;

  const isActive = (to) => {
    return to === '/' && location.pathname === '/';
  };

  if (isAdminRoute) {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
          <Link to="/admin/dashboard" className="flex items-center gap-3 text-violet-600">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
              <Ticket size={20} />
            </span>
            <div>
              <p className="text-xl font-black leading-tight tracking-tight text-slate-950">TicketRush</p>
              <p className="text-xs font-semibold text-slate-400">Admin Portal</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              title="System status"
            >
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
              <ShieldCheck size={18} />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              title="Admin settings"
            >
              <Settings size={18} />
            </button>
            <UserMenu />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3 text-violet-600">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
            <Ticket size={20} />
          </span>
          <span className="text-2xl font-black tracking-tight text-slate-900">TicketRush</span>
        </Link>

        {showNavLinks && (
          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive(item.to) ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          {token ? (
            <>
              <NotificationBell />
              <UserMenu />
              <Link to="/orders" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200">
                <UserCircle2 size={18} className="text-violet-500" />
                My Tickets
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-white">
                Login
              </Link>
              <Link to="/register" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500">
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        >
          <Menu size={20} />
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-4 lg:hidden">
          <div className="space-y-2">
            {showNavLinks && navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
            {token && (
              <>
                <Link
                  to="/orders"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  My Tickets
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Profile
                </Link>
              </>
            )}
          </div>
          {!token && (
            <div className="mt-4 flex gap-3">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                Login
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="flex-1 rounded-full bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white">
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
