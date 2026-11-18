export interface User {
  id: string;
  name: string;
  role: 'user' | 'business';
  wallet_balance: number;
}

export interface Toilet {
  id: number;
  owner_id: string | null;
  name: string;
  type: 'public' | 'business';
  category: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  perk_note: string | null;
  open_hours: string;
  hours_verified?: boolean;
  closed_by_hours?: boolean;
  status: 'open' | 'closed' | 'maintenance';
  access_method: 'door_pin' | 'kiosk_qr';
  door_pin?: string | null;
  location_hint: string | null;
  wheelchair_accessible: boolean;
  baby_changing: boolean;
  rating_avg: number;
  rating_count: number;
  recent_maintenance_reports?: number;
  distance_meters: number | null;
  walk_minutes: number | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  user_id: string;
  toilet_id: number;
  code: string;
  amount: number;
  platform_fee: number;
  business_net: number;
  status: 'active' | 'used' | 'expired';
  expires_at: string;
  used_at: string | null;
  created_at: string;
  toilet_name?: string;
  toilet_address?: string;
  perk_note?: string | null;
  access_method?: 'door_pin' | 'kiosk_qr';
  door_pin?: string | null;
  location_hint?: string | null;
  lat?: number;
  lng?: number;
}

export interface Review {
  id: number;
  toilet_id: number;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface BusinessTransaction extends Ticket {
  toilet_name: string;
  customer_name: string;
}

export interface BusinessReview extends Review {
  toilet_name: string;
}

export interface BusinessDashboard {
  owner: User;
  toilets: Toilet[];
  transactions: BusinessTransaction[];
  reviews: BusinessReview[];
  summary: {
    total_uses: number;
    gross_revenue: number;
    total_fees: number;
    net_revenue: number;
  };
}
