import axios from 'axios';

const EVENT_API_BASE = 'http://localhost:8080/api';

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
