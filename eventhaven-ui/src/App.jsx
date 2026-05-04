import { BrowserRouter as Router } from 'react-router-dom';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AppRoutes } from './AppRoutes';
import './App.css';

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
    </Router>
  );
}

export default App;
