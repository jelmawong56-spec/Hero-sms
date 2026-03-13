export interface HeroSMSConfig {
  apiKey: string;
  baseUrl: string;
}

export interface BalanceResponse {
  balance: number;
}

export interface NumberResponse {
  activationId: string;
  phoneNumber: string;
  price?: number;
}

export interface StatusResponse {
  status: 'STATUS_WAIT_CODE' | 'STATUS_OK' | 'STATUS_CANCEL' | 'STATUS_WAIT_RETRY';
  code?: string;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  minPrice: number;
  maxPrice: number;
}

export interface OrderDetails {
  id: string;
  phoneNumber: string;
  country: Country;
  price: number;
  status: 'pending' | 'waiting_otp' | 'completed' | 'cancelled';
  code?: string;
  createdAt: Date;
}

export const COUNTRIES: Country[] = [
  { id: 10, name: 'Vietnam', code: 'VN', minPrice: 0.15, maxPrice: 0.25 },
  { id: 4, name: 'Philippines', code: 'PH', minPrice: 0.16, maxPrice: 0.26 },
  { id: 52, name: 'Colombia', code: 'CO', minPrice: 0.18, maxPrice: 0.24 },
];

export const SERVICE_CODE = 'wa'; // WhatsApp service code
