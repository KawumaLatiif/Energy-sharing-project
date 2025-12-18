'use server';

import { authFetch } from "@/lib/auth";


export async function getAdminStats() {
  const API_BASE = 'http://localhost:8000/api/v1';
  const res = await authFetch(`${API_BASE}/admin/dashboard/`);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { error: 'unauthorized' };
    }
    return { error: 'failed' };
  }

  return await res.json();
}