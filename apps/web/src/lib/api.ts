'use client';

import axios, { AxiosInstance, AxiosResponse } from 'axios';

// ============================================================
// Create axios instance
// ============================================================
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ============================================================
// Request interceptor — attach Bearer token
// ============================================================
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hd_auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { state?: { token?: string } };
          const token = parsed?.state?.token;
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ============================================================
// Response interceptor — handle 401
// ============================================================
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('hd_auth');
      localStorage.removeItem('hd_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ============================================================
// Typed helper functions
// ============================================================
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.get(url, { params });
  return response.data;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.post(url, data);
  return response.data;
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.patch(url, data);
  return response.data;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.put(url, data);
  return response.data;
}

export async function del<T>(url: string): Promise<T> {
  const response: AxiosResponse<T> = await apiClient.delete(url);
  return response.data;
}

export default apiClient;
