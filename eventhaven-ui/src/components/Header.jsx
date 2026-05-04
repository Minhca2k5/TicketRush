import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, Search, Settings, Shield, ShieldCheck, Ticket, UserCircle2 } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { getAuthRole, getAuthToken } from '../lib/auth';

const navItems = [
  { label: 'Home', to: '/' },
];

const categoryItems = [
  { label: 'Concerts', to: '/?category=concerts' },
  { label: 'Sports', to: '/?category=sports' },
  { label: 'Theater', to: '/?category=theater' },
  { label: 'Conference', to: '/?category=conference' },
];

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('search') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const token = getAuthToken();
  const role = getAuthRole();
  const category = useMemo(() => new URLSearchParams(location.search).get('category') || '', [location.search]);
  const selectedCategoryLabel = useMemo(() => {
    return categoryItems.find((item) => new URLSearchParams(item.to.split('?')[1]).get('category') === category)?.label || 'Categories';
  }, [category]);
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams(location.search);
    if (query.trim()) {
      params.set('search', query.trim());
    } else {
      params.delete('search');
    }
    navigate(`/?${params.toString()}`);
    setMenuOpen(false);
  };

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/' && !category;
    if (to.includes('category=')) {
      return new URLSearchParams(to.split('?')[1]).get('category') === category;
    }
    return false;
  };

  if (isAdminRoute) {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
          <Link
            to="/"
            className="rounded-full bg-violet-50 px-5 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
          >
            Home
          </Link>
          <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 justify-center">
            <div className="flex w-full max-w-2xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 shadow-sm">
              <Search size={18} className="text-violet-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <span className="hidden text-xs font-semibold text-slate-400 sm:inline">⌘K</span>
            </div>
          </form>
          <div className="hidden items-center gap-4 lg:flex">
            <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
              <ShieldCheck size={18} />
            </button>
            <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setCategoryMenuOpen((value) => !value)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                category ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {selectedCategoryLabel}
              <ChevronDown size={16} className={categoryMenuOpen ? 'rotate-180 transition' : 'transition'} />
            </button>
            {categoryMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
                <div className="max-h-80 overflow-y-auto">
                  {categoryItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={() => setCategoryMenuOpen(false)}
                      className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        isActive(item.to) ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        <form onSubmit={handleSubmit} className="hidden flex-1 justify-center lg:flex">
          <div className="flex w-full max-w-xl items-center gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-lg shadow-slate-200/60">
            <Search size={18} className="text-violet-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events, venues, or artists"
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </form>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          {token ? (
            <>
              <NotificationBell />
              {role === 'ADMIN' && (
                <Link
                  to="/admin/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50"
                >
                  <Shield size={17} />
                  Admin
                </Link>
              )}
              <UserMenu />
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
          <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200">
            <UserCircle2 size={18} className="text-violet-500" />
            My Tickets
          </button>
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
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={18} className="text-violet-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events..."
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>
          </form>
          <div className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="px-4 pt-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Categories</div>
            {categoryItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
            {role === 'ADMIN' && (
              <Link
                to="/admin/dashboard"
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
              >
                Admin
              </Link>
            )}
            {token && (
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Profile
              </Link>
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
