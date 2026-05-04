import { Navigate, useLocation } from 'react-router-dom';
import { getAuthRole, isAuthenticated } from '../lib/auth';

export function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole && getAuthRole() !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
