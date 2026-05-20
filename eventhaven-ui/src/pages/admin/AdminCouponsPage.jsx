import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  FileBarChart2,
  LifeBuoy,
  Menu,
  Percent,
  Plus,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAllCoupons, createCoupon, deleteCoupon } from '../../services/bookingService';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users, to: '/admin/customers' },
  { label: 'System Reports', icon: FileBarChart2, to: '/admin/reports' },
  { label: 'Coupon Codes', icon: Tag, to: '/admin/coupons' },
  { label: 'Admin Settings', icon: Settings, to: '/admin/settings' },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy, to: '/admin/help' },
  { label: 'System Status', icon: ShieldCheck, to: '/admin/status' },
];

export default function AdminCouponsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const data = await getAllCoupons();
      setCoupons(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError('Không thể tải danh sách mã giảm giá');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!code.trim() || !discountValue) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: Number(minOrderAmount || 0),
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        active,
      };

      await createCoupon(payload);
      setSuccess('Tạo mã giảm giá thành công!');
      
      // Reset form
      setCode('');
      setDiscountType('PERCENTAGE');
      setDiscountValue('');
      setMinOrderAmount('0');
      setMaxDiscountAmount('');
      setMaxUses('');
      setExpiresAt('');
      setActive(true);

      // Refresh list
      fetchCoupons();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi khi tạo mã giảm giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã giảm giá này?')) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      await deleteCoupon(id);
      setSuccess('Xóa mã giảm giá thành công!');
      fetchCoupons();
    } catch (err) {
      setError('Lỗi khi xóa mã giảm giá');
    }
  };

  const renderSidebarContent = () => (
    <>
      <div className="px-5 py-7">
        <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Main</p>
        <div className="mt-4 space-y-2">
          {sidebarMain.map(({ label, icon: Icon, to }) => {
            const isActive = to ? location.pathname.startsWith(to) : false;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { if (to) navigate(to); setMobileSidebarOpen(false); }}
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
          {sidebarSupport.map(({ label, icon: Icon, to }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <button
                key={label}
                type="button"
                onClick={() => { navigate(to); setMobileSidebarOpen(false); }}
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
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-slate-900">
      {/* Mobile sidebar */}
      {mobileSidebarOpen && (
        <>
          <div className="admin-sidebar-overlay lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
          <div className="admin-sidebar-mobile lg:hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <span className="text-lg font-black text-slate-900">Menu</span>
              <button type="button" onClick={() => setMobileSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </>
      )}

      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] self-start flex-col overflow-y-auto border-r border-[#dde6f0] bg-white lg:flex">
          {renderSidebarContent()}
        </aside>

        <div className="min-w-0">
          <main className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-sm lg:hidden"
                >
                  <Menu size={18} />
                </button>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-950">Coupon Codes Management</h1>
                  <p className="mt-2 text-sm text-slate-500">Create, monitor and manage discount coupons for user checkouts.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {success}
              </div>
            )}

            <div className="mt-8 grid gap-6 xl:grid-cols-12">
              {/* Form to create coupon */}
              <section className="xl:col-span-4 rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
                  <Plus size={20} className="text-violet-600" />
                  Create Coupon
                </h2>
                <form onSubmit={handleCreateCoupon} className="mt-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mã giảm giá *</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: SUMMER20"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Loại giảm giá</label>
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      >
                        <option value="PERCENTAGE">Phần trăm (%)</option>
                        <option value="FIXED">Số tiền cố định</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Giá trị giảm *</label>
                      <input
                        type="number"
                        placeholder={discountType === 'PERCENTAGE' ? 'Ví dụ: 20' : 'Ví dụ: 50000'}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                        required
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Đơn tối thiểu</label>
                      <input
                        type="number"
                        placeholder="Ví dụ: 100000"
                        value={minOrderAmount}
                        onChange={(e) => setMinOrderAmount(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Giảm tối đa</label>
                      <input
                        type="number"
                        placeholder="Để trống nếu không giới hạn"
                        value={maxDiscountAmount}
                        onChange={(e) => setMaxDiscountAmount(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                        disabled={discountType === 'FIXED'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lượt dùng tối đa</label>
                      <input
                        type="number"
                        placeholder="Ví dụ: 100"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ngày hết hạn</label>
                      <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="active"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <label htmlFor="active" className="text-sm font-bold text-slate-700 cursor-pointerSelect">Kích hoạt mã ngay</label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Coupon'}
                  </button>
                </form>
              </section>

              {/* Coupons List */}
              <section className="xl:col-span-8 rounded-[28px] border border-[#dfe7f2] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-950">Active Coupons</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    Total: {coupons.length}
                  </span>
                </div>

                {loading ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-500">Loading coupons...</div>
                ) : coupons.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-500">No coupons configured yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          <th className="px-6 py-4">Code</th>
                          <th className="px-4 py-4">Type / Value</th>
                          <th className="px-4 py-4">Min Order</th>
                          <th className="px-4 py-4">Uses</th>
                          <th className="px-4 py-4">Expires</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map((coupon) => {
                          const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                          const isOutOfUses = coupon.maxUses && coupon.usedCount >= coupon.maxUses;
                          const isValid = coupon.active && !isExpired && !isOutOfUses;

                          return (
                            <tr key={coupon.id} className="border-t border-slate-100 text-sm text-slate-600 hover:bg-slate-50/50">
                              <td className="px-6 py-4">
                                <span className="font-extrabold uppercase bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg border border-violet-100">
                                  {coupon.code}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-semibold text-slate-900">
                                {coupon.discountType === 'PERCENTAGE' ? (
                                  <span>{coupon.discountValue}% (Max: {coupon.maxDiscountAmount ? `${coupon.maxDiscountAmount.toLocaleString()}đ` : '∞'})</span>
                                ) : (
                                  <span>{coupon.discountValue.toLocaleString()}đ</span>
                                )}
                              </td>
                              <td className="px-4 py-4 font-medium">
                                {coupon.minOrderAmount > 0 ? `${coupon.minOrderAmount.toLocaleString()}đ` : 'None'}
                              </td>
                              <td className="px-4 py-4 font-semibold">
                                {coupon.usedCount} / {coupon.maxUses || '∞'}
                              </td>
                              <td className="px-4 py-4 text-xs font-medium text-slate-500">
                                {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  isValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {isValid ? 'Active' : isExpired ? 'Expired' : isOutOfUses ? 'Sold Out' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCoupon(coupon.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:text-red-500"
                                  title="Delete coupon"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
