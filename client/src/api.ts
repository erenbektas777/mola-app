import type { BusinessDashboard, Review, Ticket, Toilet, User } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Bir hata oluştu.');
  }
  return data as T;
}

export interface ToiletFilters {
  type?: 'all' | 'public' | 'business';
  onlyOpen?: boolean;
  wheelchair?: boolean;
  babyChanging?: boolean;
  search?: string;
  lat?: number;
  lng?: number;
}

export const api = {
  getUser: (userId: string) => request<User>(`/api/users/${userId}`),

  topUpUser: (userId: string, amount: number) =>
    request<User>(`/api/users/${userId}/topup`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  getToilets: (filters: ToiletFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.onlyOpen) params.set('onlyOpen', 'true');
    if (filters.wheelchair) params.set('wheelchair', 'true');
    if (filters.babyChanging) params.set('babyChanging', 'true');
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (filters.lat !== undefined && filters.lng !== undefined) {
      params.set('lat', String(filters.lat));
      params.set('lng', String(filters.lng));
    }
    const qs = params.toString();
    return request<Toilet[]>(`/api/toilets${qs ? `?${qs}` : ''}`);
  },

  createToilet: (payload: {
    owner_id: string;
    name: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    price: number;
    perk_note?: string;
    open_hours: string;
    access_method: 'door_pin' | 'kiosk_qr';
    door_pin?: string;
    location_hint?: string;
    wheelchair_accessible: boolean;
    baby_changing: boolean;
  }) =>
    request<Toilet>('/api/toilets', {
      method: 'POST',
      body: JSON.stringify({ ...payload, type: 'business' }),
    }),

  suggestToilet: (payload: {
    name: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    wheelchair_accessible: boolean;
    baby_changing: boolean;
  }) =>
    request<Toilet>('/api/toilets/suggest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateToiletStatus: (id: number, status: 'open' | 'closed' | 'maintenance') =>
    request<Toilet>(`/api/toilets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  reportStatus: (
    id: number,
    payload: {
      userId: string;
      reportType: 'maintenance' | 'open';
      reason?: string;
      lat: number;
      lng: number;
    }
  ) =>
    request<{
      status: 'open' | 'closed' | 'maintenance';
      recent_maintenance_reports: number;
      threshold: number;
      message: string;
    }>(`/api/toilets/${id}/report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateToiletAccess: (
    id: number,
    payload: { door_pin?: string; location_hint?: string; price?: number; perk_note?: string }
  ) =>
    request<Toilet>(`/api/toilets/${id}/access`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  withdrawBusiness: (ownerId: string, payload: { amount: number; iban: string }) =>
    request<{ wallet_balance: number; message: string }>(`/api/business/${ownerId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reportHours: (id: number, payload: { userId: string; openHours: string }) =>
    request<{
      open_hours: string;
      hours_verified: boolean;
      status: 'open' | 'closed' | 'maintenance';
      closed_by_hours: boolean;
      confirmations: number;
      threshold: number;
      message: string;
    }>(`/api/toilets/${id}/hours`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  buyTicket: (userId: string, toiletId: number) =>
    request<{ ticket: Ticket; wallet_balance: number }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ userId, toiletId }),
    }),

  verifyTicket: (code: string, ownerId: string) =>
    request<{ message: string; ticket: Ticket; toilet_name: string }>('/api/tickets/verify', {
      method: 'POST',
      body: JSON.stringify({ code, ownerId }),
    }),

  getUserTickets: (userId: string) => request<Ticket[]>(`/api/tickets/user/${userId}`),

  getReviews: (toiletId: number) => request<Review[]>(`/api/toilets/${toiletId}/reviews`),

  addReview: (
    toiletId: number,
    payload: { userId: string; userName: string; rating: number; comment: string }
  ) =>
    request<{ review: Review; rating_avg: number; rating_count: number }>(
      `/api/toilets/${toiletId}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  getBusinessDashboard: (ownerId: string) =>
    request<BusinessDashboard>(`/api/business/${ownerId}/dashboard`),
};
