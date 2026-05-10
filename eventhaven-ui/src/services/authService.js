import axios from 'axios';
import { getAuthToken } from '../lib/auth';

const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE_URL || 'http://localhost:8080';

const authApi = axios.create({
  baseURL: AUTH_API_BASE,
});

authApi.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export async function getProfile() {
  const response = await authApi.get('/auth/profile');
  return response.data?.data || response.data;
}

export async function updateProfile(payload) {
  const response = await authApi.put('/auth/profile', payload);
  return response.data?.data || response.data;
}

export async function getAuthDashboardSummary() {
  const response = await authApi.get('/auth/dashboard');
  return response.data?.data || response.data;
}

export async function getAuthUsers() {
  const response = await authApi.get('/auth/users');
  return response.data?.data || response.data;
}

export async function getAuthSettings() {
  const response = await authApi.get('/auth/settings');
  return response.data?.data || response.data;
}
