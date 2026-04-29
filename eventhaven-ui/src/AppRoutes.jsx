import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import EventDetail from './components/EventDetail';
import AdminEvents from './components/AdminEvents';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} />
      <Route path="/events/:id" element={<EventDetail />} />
      <Route path="/admin/events" element={<AdminEvents />} />
    </Routes>
  );
}
