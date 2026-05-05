import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import EventDetail from './components/EventDetail';
import AdminEvents from './components/AdminEvents';
import AdminEventDetail from './components/AdminEventDetail';
import AdminDashboard from './components/AdminDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import Profile from './components/Profile';
import TicketSalesPage from './pages/admin/TicketSalesPage';
import OrderHistory from './pages/OrderHistory';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} />
      <Route path="/events/:id" element={<EventDetail />} />
      <Route path="/orders" element={<OrderHistory />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events/:id"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminEventDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sales"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <TicketSalesPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
