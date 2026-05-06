import {
  BarChart3,
  CalendarDays,
  FileBarChart2,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserMenu } from '../../components/UserMenu';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users, to: '/admin/customers' },
  { label: 'System Reports', icon: FileBarChart2, to: '/admin/reports' },
  { label: 'Admin Settings', icon: Settings, to: '/admin/settings' },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy },
  { label: 'System Status', icon: ShieldCheck },
];

const pageConfig = {
  customers: {
    title: 'Customer Database',
    subtitle: 'Browse customer profile coverage and prepare audience exports for the demo.',
    icon: Users,
    stats: [
      ['Profile fields', 'Username, email, role, age, gender'],
      ['Source service', 'Auth Service'],
      ['Demo check', 'Update age/gender from Profile UI'],
    ],
  },
  reports: {
    title: 'System Reports',
    subtitle: 'Review gateway, queue, and service readiness notes before the final walkthrough.',
    icon: FileBarChart2,
    stats: [
      ['Gateway routes', 'Auth, Events, Booking, Queue'],
      ['Trace header', 'X-Trace-Id'],
      ['Queue identity', 'X-User-Id from JWT'],
    ],
  },
  settings: {
    title: 'Admin Settings',
    subtitle: 'Verify operational settings that matter for the Auth and Gateway demo.',
    icon: Settings,
    stats: [
      ['Admin account', 'admin / admin123'],
      ['JWT lifetime', '24 hours'],
      ['Frontend gateway', 'http://localhost:8080'],
    ],
  },
};

export default function AdminUtilityPage({ type }) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = pageConfig[type] || pageConfig.customers;
  const PageIcon = config.icon;

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-r border-[#dde6f0] bg-white">
          <div className="flex items-center gap-4 border-b border-[#e8edf4] px-8 py-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Ticket size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-950">TicketRush</p>
              <p className="text-sm text-slate-500">Admin Portal</p>
            </div>
          </div>

          <div className="px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Main</p>
            <div className="mt-4 space-y-2">
              {sidebarMain.map(({ label, icon: Icon, to }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate(to)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive ? 'bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-[#e8edf4] px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Support</p>
            <div className="mt-4 space-y-2">
              {sidebarSupport.map(({ label, icon: Icon }) => (
                <button key={label} type="button" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <PageIcon size={20} />
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{config.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">{config.subtitle}</p>
            </div>
            <UserMenu />
          </div>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {config.stats.map(([label, value]) => (
              <article key={label} className="rounded-[24px] border border-[#dfe7f2] bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-3 text-lg font-black text-slate-950">{value}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
            <h2 className="text-xl font-black text-slate-950">Demo Status</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This section is wired into the admin navigation so the sidebar behaves consistently during the demo.
              Deeper data tables and report exports can be added after the core event, booking, and dashboard flows are stable.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
