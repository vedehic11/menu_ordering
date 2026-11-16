export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SessionStatus =
  | 'open'
  | 'bill_requested'
  | 'closing'
  | 'settled'
  | 'cancelled';

export type KitchenStation =
  | 'robata'
  | 'pizza'
  | 'mains'
  | 'bar'
  | 'pastry';

export type KitchenStatus =
  | 'received'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

export type PaymentTender = 'cash' | 'upi' | 'card' | 'other';

export type StaffRole = 'owner' | 'manager' | 'cashier' | 'chef' | 'captain';

// Keep legacy aliases for backwards compatibility
export type OrderStatus = KitchenStatus;
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'counter' | 'online';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiningTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  qr_token: string;
  is_active: boolean;
  created_at: string;
}

export interface TableSession {
  id: string;
  table_id: string;
  table_number?: string;
  session_number: number;
  status: SessionStatus;
  guest_count: number;
  opened_at: string;
  closed_at: string | null;
  opened_by_id?: string | null;
  closed_by_id?: string | null;
  orders?: StoredOrder[];
  settlement?: Settlement | null;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  station: KitchenStation;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_paise: number;
  image_url: string | null;
  calories?: number | null;
  protein_grams?: number | null;
  carbs_grams?: number | null;
  fat_grams?: number | null;
  station: KitchenStation;
  is_available: boolean;
  is_vegetarian: boolean;
  is_chef_special?: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  station: KitchenStation;
  unit_price_paise: number;
  quantity: number;
  special_instructions: string | null;
  line_total_paise: number;
  is_done?: boolean;
  is_voided?: boolean;
  void_reason?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  session_id: string;
  restaurant_id?: string;
  table_id?: string;
  table_number?: string;
  customer_id?: string;
  round_number: number;
  kitchen_status: KitchenStatus;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  special_instructions: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  // Legacy compatibility helpers
  order_status?: KitchenStatus;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod;
}

export interface StoredOrder extends Order {
  table_number: string;
  table_id: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  items: OrderItem[];
}

export interface SettlementPayment {
  id: string;
  settlement_id: string;
  tender: PaymentTender;
  amount_paise: number;
  reference?: string | null;
  received_at: string;
}

export interface Settlement {
  id: string;
  session_id: string;
  cashier_id?: string | null;
  shift_id?: string | null;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paid_paise: number;
  settled_at: string;
  payments: SettlementPayment[];
}

export interface ServiceRequest {
  id: string;
  table_id: string;
  table_number: string;
  type: 'water' | 'waiter' | 'cutlery' | 'bill';
  note?: string | null;
  status: 'pending' | 'resolved';
  created_at: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export interface CarouselSlide {
  id: string;
  image: string;
  title: string;
  sub: string;
  isActive?: boolean;
}
