import { BrowserRouter as Router, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChatbotWidget } from './components/ChatbotWidget';
import { AppRoutes } from './AppRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getAuthRole, isAuthenticated } from './lib/auth';
import './App.css';

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
  const isAdminSignedIn = isAuthenticated() && getAuthRole() === 'ADMIN';

  if (isAdminSignedIn && !isAdminRoute && !isAuthRoute) {
    return <Navigate to="/admin" replace />;
  }

  if (isAdminRoute) {
    return (
      <div className="app-layout app-layout--admin">
        <Header />
        <main className="main-content main-content--admin">
          <AppRoutes />
        </main>
      </div>
    );
  }

  if (isAuthRoute) {
    return (
      <div className="app-layout">
        <main className="main-content main-content--auth">
          <AppRoutes />
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Header />
      <main className="main-content main-content--customer">
        <AppRoutes />
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppShell />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
