import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Header } from '../components/Header';
import { getUserOrders } from '../services/bookingService';

const HOLDER_STORAGE_KEY = "ticketrush-seat-holder";
function getUserId() {
  return window.localStorage.getItem(HOLDER_STORAGE_KEY);
}

function TicketModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-[32px] shadow-2xl">
        <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-100 p-6 flex items-center justify-between z-10 rounded-t-[32px]">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Your E-Tickets</h2>
            <p className="text-sm text-slate-500">Order #{order.id}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {order.tickets?.map((ticket, idx) => (
            <div key={ticket.id} className="border-2 border-dashed border-violet-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 bg-[linear-gradient(135deg,#f8faff_0%,#f5f3ff_100%)]">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 shrink-0">
                <QRCodeSVG value={ticket.qrCodeToken} size={150} level="H" includeMargin={true} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <span className="inline-block px-3 py-1 bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                  Ticket {idx + 1}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Official E-Ticket</h3>
                <p className="text-slate-500 text-sm mb-4">Please present this QR code at the entrance.</p>
                <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Seat ID</p>
                    <p className="font-bold text-slate-900">{ticket.seatId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Ticket ID</p>
                    <p className="font-bold text-slate-900">#{ticket.id}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    getUserOrders(userId)
      .then(res => {
        // Sort newest first
        const sorted = (res || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(sorted);
      })
      .catch(err => console.error("Failed to load orders", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">My Tickets</h1>
          <p className="text-slate-500 mt-2">View your past purchases and access your E-Tickets.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="text-6xl mb-4">🎫</div>
            <h2 className="text-xl font-bold text-slate-900">No tickets found</h2>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">You haven't purchased any tickets yet. Explore events and book your seats!</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] gap-6 hover:border-violet-200 transition">
                <div className="flex items-center gap-6 w-full sm:w-auto">
                  <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    🧾
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Order #{order.id}</h3>
                    <p className="text-sm text-slate-500">
                      Purchased on {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-md">
                        {order.status}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        ${order.totalPrice.toLocaleString()}
                      </span>
                      <span className="text-sm text-slate-500">
                        • {order.tickets?.length || 0} tickets
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrder(order)}
                  className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-violet-600 transition shadow-lg shrink-0"
                >
                  View Tickets
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedOrder && (
        <TicketModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}
