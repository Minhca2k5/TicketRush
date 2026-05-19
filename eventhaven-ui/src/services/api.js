import axios from 'axios';

export const EVENT_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export function getApiOrigin() {
  return new URL(EVENT_API_BASE).origin;
}

const api = axios.create({
  baseURL: EVENT_API_BASE,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
