'use client';

// Client-side auth utility
export function getClientAuthToken() {
  if (typeof window === 'undefined') return null;
  
  // Try to get token from localStorage
  const token = localStorage.getItem('access_token');
  if (token) return token;
  
  // Try to get from cookies (for browser environments)
  const match = document.cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
}

export function getClientAuthHeaders() {
  const token = getClientAuthToken();
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export async function clientAuthFetch(url: string, options: RequestInit = {}) {
  const token = getClientAuthToken();
  
  const headers = {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  console.log('🔗 API Call:', url);
  console.log('🔑 Token present:', !!token);
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  console.log('📊 Response Status:', response.status);
  return response;
}

// Helper for token refresh
export async function refreshAuthToken() {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;

    const response = await fetch('http://localhost:8000/api/v1/refresh/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      return data.access;
    }
  } catch (error) {
    console.error('Token refresh error:', error);
  }
  return null;
}