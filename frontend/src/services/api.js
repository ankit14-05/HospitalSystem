// src/services/api.js
import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request interceptor — attach token & hospital header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    const hospitalId = localStorage.getItem('hospitalId');
    if (hospitalId) config.headers['X-Hospital-Id'] = hospitalId;

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || 'Something went wrong.';

    if (status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      // Redirect to login (handled by AuthContext)
      window.dispatchEvent(new Event('auth:expired'));
    } else if (status === 422) {
      // Let callers handle validation errors
    } else if (status === 429) {
      toast.error('Too many requests. Please slow down.');
    } else if (status >= 500) {
      toast.error('Server error. Please try again.');
    }

    return Promise.reject({ message, status, errors: error.response?.data?.errors });
  }
);

export default api;

// ── Auth
export const authAPI = {
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword:  (data) => api.post('/auth/reset-password', data),
  verifyOtp:      (data) => api.post('/auth/verify-otp', data),
  me:             ()     => api.get('/auth/me'),
};

// ── Geography
export const geoAPI = {
  countries:     ()       => api.get('/geo/countries'),
  states:        (cId)    => api.get(`/geo/countries/${cId}/states`),
  districts:     (sId)    => api.get(`/geo/states/${sId}/districts`),
  pincodes:      (dId)    => api.get(`/geo/districts/${dId}/pincodes`),
  searchPincode: (q)      => api.get(`/geo/pincodes/search?q=${q}`),
  lookup:        (cat)    => api.get(`/geo/lookup/${cat}`),
  addDistrict:   (data)   => api.post('/geo/districts/custom', data),
  addPincode:    (data)   => api.post('/geo/pincodes/custom', data),
};

// ── Hospitals
export const hospitalAPI = {
  list:     (params) => api.get('/hospitals', { params }),
  get:      (id)     => api.get(`/hospitals/${id}`),
  create:   (data)   => api.post('/hospitals', data),
  update:   (id, d)  => api.put(`/hospitals/${id}`, d),
  delete:   (id, d)  => api.delete(`/hospitals/${id}`, { data: d }),
  log:      (id)     => api.get(`/hospitals/${id}/setup-log`),
  depts:    (id)     => api.get(`/hospitals/${id}/departments`),
};

// ── Setup masters
export const setupAPI = {
  specializations: () => api.get('/setup/specializations'),
  qualifications:  () => api.get('/setup/qualifications'),
  councils:        () => api.get('/setup/medical-councils'),
  services:        (p) => api.get('/setup/services', { params: p }),
  medicines:       (p) => api.get('/setup/medicines', { params: p }),
  icdCodes:        (p) => api.get('/setup/icd-codes', { params: p }),
  labTests:        (p) => api.get('/setup/lab-tests', { params: p }),
};

// ── Users
export const userAPI = {
  list:         (params) => api.get('/users', { params }),
  create:       (data)   => api.post('/users', data),
  toggleActive: (id)     => api.patch(`/users/${id}/toggle-active`),
  changePass:   (id, d)  => api.patch(`/users/${id}/change-password`, d),
};
