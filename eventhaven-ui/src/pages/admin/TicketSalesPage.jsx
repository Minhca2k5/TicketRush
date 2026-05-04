import { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileBarChart2,
  LifeBuoy,
  Receipt,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import RevenueTrendChart from '../../components/admin/RevenueTrendChart';
import SalesStatCard from '../../components/admin/SalesStatCard';
import SalesTable from '../../components/admin/SalesTable';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users },
  { label: 'System Reports', icon: FileBarChart2 },
  { label: 'Admin Settings', icon: Settings },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy },
  { label: 'System Status', icon: ShieldCheck },
];

const timeFilters = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày qua' },
  { key: 'month', label: 'Tháng này' },
];

function createRelativeDate(daysAgo, hours, minutes = 15) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

const mockOrders = [
  { id: 1, orderId: '#ORD-9921', eventName: 'Summer Music Festival 2026', customer: 'Emma Carter', createdAt: createRelativeDate(0, 9), amount: 1280, status: 'Completed', ticketCount: 4, refundedTickets: 0 },
  { id: 2, orderId: '#ORD-9917', eventName: 'Neon Skyline Festival', customer: 'Noah Bennett', createdAt: createRelativeDate(0, 14), amount: 540, status: 'Pending', ticketCount: 2, refundedTickets: 0 },
  { id: 3, orderId: '#ORD-9898', eventName: 'Championship Night Finals', customer: 'Sophia Nguyen', createdAt: createRelativeDate(1, 18), amount: 960, status: 'Completed', ticketCount: 3, refundedTickets: 0 },
  { id: 4, orderId: '#ORD-9885', eventName: 'Future Summit 2026', customer: 'Lucas Tran', createdAt: createRelativeDate(1, 11), amount: 420, status: 'Completed', ticketCount: 2, refundedTickets: 0 },
  { id: 5, orderId: '#ORD-9874', eventName: 'Midnight Orchestra', customer: 'Olivia Pham', createdAt: createRelativeDate(2, 16), amount: 310, status: 'Refunded', ticketCount: 2, refundedTickets: 2 },
  { id: 6, orderId: '#ORD-9850', eventName: 'Summer Music Festival 2026', customer: 'Mia Roberts', createdAt: createRelativeDate(3, 10), amount: 840, status: 'Completed', ticketCount: 3, refundedTickets: 0 },
  { id: 7, orderId: '#ORD-9838', eventName: 'Concert: Rock Universe 2026', customer: 'Ethan Hoang', createdAt: createRelativeDate(4, 13), amount: 460, status: 'Completed', ticketCount: 2, refundedTickets: 0 },
  { id: 8, orderId: '#ORD-9822', eventName: 'Championship Night Finals', customer: 'Ava Le', createdAt: createRelativeDate(5, 15), amount: 1180, status: 'Completed', ticketCount: 4, refundedTickets: 0 },
  { id: 9, orderId: '#ORD-9806', eventName: 'Future Summit 2026', customer: 'William Scott', createdAt: createRelativeDate(7, 9), amount: 390, status: 'Pending', ticketCount: 2, refundedTickets: 0 },
  { id: 10, orderId: '#ORD-9781', eventName: 'Neon Skyline Festival', customer: 'Charlotte Vu', createdAt: createRelativeDate(10, 19), amount: 720, status: 'Completed', ticketCount: 3, refundedTickets: 0 },
  { id: 11, orderId: '#ORD-9756', eventName: 'Midnight Orchestra', customer: 'James Kim', createdAt: createRelativeDate(14, 20), amount: 270, status: 'Refunded', ticketCount: 1, refundedTickets: 1 },
  { id: 12, orderId: '#ORD-9734', eventName: 'Summer Music Festival 2026', customer: 'Harper Dao', createdAt: createRelativeDate(18, 12), amount: 1540, status: 'Completed', ticketCount: 5, refundedTickets: 0 },
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatDateTime(value) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function TicketSalesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFilter, setSelectedFilter] = useState('7d');

  const filteredOrders = useMemo(() => {
    const today = startOfToday();

    return mockOrders.filter((order) => {
      const createdAt = new Date(order.createdAt);

      if (selectedFilter === 'today') {
        return createdAt >= today;
      }

      if (selectedFilter === 'month') {
        return createdAt >= startOfMonth();
      }

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return createdAt >= sevenDaysAgo;
    });
  }, [selectedFilter]);

  const stats = useMemo(() => {
    const completedOrders = filteredOrders.filter((order) => order.status === 'Completed');
    const completedRevenue = completedOrders.reduce((sum, order) => sum + order.amount, 0);
    const soldTickets = completedOrders.reduce((sum, order) => sum + order.ticketCount, 0);
    const refundedTickets = filteredOrders.reduce((sum, order) => sum + order.refundedTickets, 0);
    const averageOrderValue = completedOrders.length ? Math.round(completedRevenue / completedOrders.length) : 0;

    return [
      {
        label: 'Total Revenue',
        value: formatCurrency(completedRevenue),
        hint: `${completedOrders.length} completed orders`,
        icon: DollarSign,
        surface: 'from-violet-50 to-fuchsia-50',
        iconBg: 'bg-violet-100 text-violet-600',
      },
      {
        label: 'Tickets Sold',
        value: soldTickets.toLocaleString(),
        hint: 'Successful tickets delivered',
        icon: Ticket,
        surface: 'from-sky-50 to-blue-50',
        iconBg: 'bg-sky-100 text-sky-600',
      },
      {
        label: 'Average Order Value',
        value: formatCurrency(averageOrderValue),
        hint: 'Based on completed orders',
        icon: CreditCard,
        surface: 'from-emerald-50 to-green-50',
        iconBg: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'Refunded Tickets',
        value: refundedTickets.toLocaleString(),
        hint: 'Marked for customer refund',
        icon: RefreshCcw,
        surface: 'from-rose-50 to-red-50',
        iconBg: 'bg-rose-100 text-rose-600',
      },
    ];
  }, [filteredOrders]);

  const trendData = useMemo(() => {
    const grouped = filteredOrders.reduce((accumulator, order) => {
      const label = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      accumulator[label] = (accumulator[label] || 0) + (order.status === 'Completed' ? order.amount : 0);
      return accumulator;
    }, {});

    const points = Object.entries(grouped).map(([label, value]) => ({ label, value }));
    return points.length ? points : [{ label: 'No data', value: 0 }];
  }, [filteredOrders]);

  const recentOrders = useMemo(() => (
    [...filteredOrders].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
  ), [filteredOrders]);

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
                const isActive = to ? location.pathname.startsWith(to) : false;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => to && navigate(to)}
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

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[#dde6f0] bg-white/85 px-6 py-5 backdrop-blur-xl lg:px-8">
            <div className="flex max-w-xl flex-1 items-center gap-3 rounded-2xl border border-[#dbe3ef] bg-[#f9fbff] px-4 py-3 text-slate-400">
              <Search size={18} />
              <span className="text-sm">Search ticket orders...</span>
              <span className="ml-auto text-xs font-semibold">⌘K</span>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
                <ShieldCheck size={18} />
              </button>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
                <Settings size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-fuchsia-300 to-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                  AU
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">Admin User</p>
                  <p className="text-xs text-slate-500">Super Admin</p>
                </div>
              </div>
            </div>
          </header>

          <main className="px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Ticket Sales Analysis</h1>
                <p className="mt-2 text-sm text-slate-500">Monitor revenue, orders, and refund activity across the latest ticket transactions.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setSelectedFilter(filter.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedFilter === filter.key ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((card) => (
                <SalesStatCard key={card.label} {...card} />
              ))}
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
              <RevenueTrendChart data={trendData} formatCurrency={formatCurrency} />

              <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Sales Summary</h2>
                    <p className="mt-2 text-sm text-slate-500">Quick health check for ticket transactions.</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <TrendingUp size={18} />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Completed Orders</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">
                          {recentOrders.filter((order) => order.status === 'Completed').length}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <Receipt size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Pending Orders</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">
                          {recentOrders.filter((order) => order.status === 'Pending').length}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                        <CreditCard size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Top Event</p>
                        <p className="mt-2 text-lg font-black text-slate-950">
                          {recentOrders[0]?.eventName || 'No transactions yet'}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                        <BarChart3 size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Recent Ticket Transactions</h2>
                  <p className="mt-2 text-sm text-slate-500">Latest completed, pending, and refunded orders from the admin sales feed.</p>
                </div>
              </div>

              <SalesTable
                orders={recentOrders}
                formatDateTime={formatDateTime}
                formatCurrency={formatCurrency}
              />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
