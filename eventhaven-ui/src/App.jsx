import { BrowserRouter as Router } from 'react-router-dom';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AppRoutes } from './AppRoutes';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Home from './components/Home';
import AdminDashboard from './components/AdminDashboard';

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  if (!token) {
    window.location.href = '/login';
    return null;
  }
  if (role && userRole !== role) {
    window.location.href = '/';
    return null;
  }
  return children;
};

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            <AppRoutes />
          </main>
        </div>
      </div>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
