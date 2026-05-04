export const getAuthToken = () => localStorage.getItem('token');

export const getAuthRole = () => localStorage.getItem('role');

export const isAuthenticated = () => Boolean(getAuthToken());

export const isAdmin = () => getAuthRole() === 'ADMIN';

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
};

export const getRoleFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role;
  } catch {
    return null;
  }
};
