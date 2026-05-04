import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AppRoutes } from './AppRoutes';
import './App.css';

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

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
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
