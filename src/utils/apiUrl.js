const envBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const fallbackBaseUrl = import.meta.env.DEV
  ? 'http://localhost:3001'
  : (typeof window !== 'undefined' ? window.location.origin : '');

const RAW_API_BASE_URL = envBaseUrl || fallbackBaseUrl;

const API_BASE_URL = RAW_API_BASE_URL.endsWith('/')
  ? RAW_API_BASE_URL.slice(0, -1)
  : RAW_API_BASE_URL;

export function apiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
