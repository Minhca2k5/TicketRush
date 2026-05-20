import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import VerifyEmail from './components/VerifyEmail';
import Home from './components/Home';
import EventDetail from './components/EventDetail';
import AdminEvents from './components/AdminEvents';
import AdminEventDetail from './components/AdminEventDetail';
import AdminDashboard from './components/AdminDashboard';
import { CustomerRoute, ProtectedRoute } from './components/ProtectedRoute';
import Profile from './components/Profile';
import TicketSalesPage from './pages/admin/TicketSalesPage';
import SystemReportsPage from './pages/admin/SystemReportsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import OrderHistory from './pages/OrderHistory';
import AdminUtilityPage from './pages/admin/AdminUtilityPage';
import AllEventsPage from './pages/AllEventsPage';
import UserSettingsPage from './pages/UserSettingsPage';

import AdminCouponsPage from './pages/admin/AdminCouponsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/"
        element={
          <CustomerRoute>
            <Home />
          </CustomerRoute>
        }
      />
      <Route
        path="/events"
        element={
          <CustomerRoute>
            <AllEventsPage />
          </CustomerRoute>
        }
      />
      <Route
        path="/events/:id"
        element={
          <ProtectedRoute requiredRole="CUSTOMER">
            <EventDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute requiredRole="CUSTOMER">
            <OrderHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute requiredRole="CUSTOMER">
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredRole="CUSTOMER">
            <UserSettingsPage />
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
      <Route
        path="/admin/customers"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminUtilityPage type="customers" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <SystemReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/coupons"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminCouponsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/help"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminUtilityPage type="help" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/status"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminUtilityPage type="status" />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
