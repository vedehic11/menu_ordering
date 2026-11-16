import fs from 'fs';
import path from 'path';
import {
  TableSession,
  StoredOrder,
  MenuItem,
  ServiceRequest,
  Settlement,
  SettlementPayment,
  PaymentTender,
  KitchenStatus,
  CarouselSlide,
} from '@/types/database';

export type { ServiceRequest, CarouselSlide };
import { MOCK_MENU_ITEMS, MOCK_RESTAURANT, MOCK_TABLES } from './mock-data';

const DATA_DIR = path.join(process.cwd(), '.data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'service-requests.json');
const CAROUSEL_FILE = path.join(DATA_DIR, 'carousel.json');

export const DEFAULT_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 'slide-1',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85',
    title: 'Live Robata Grill',
    sub: 'Charcoal-fired, table-side theatre',
    isActive: true,
  },
  {
    id: 'slide-2',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85',
    title: 'Wood-Fired Sourdough',
    sub: '450°C craft-fire, 48-hour ferment',
    isActive: true,
  },
  {
    id: 'slide-3',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=1200&q=85',
    title: 'Craft Botanical Bar',
    sub: 'Cold-pressed elixirs & botanical tonics',
    isActive: true,
  },
  {
    id: 'slide-4',
    image: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1200&q=85',
    title: 'Pastry Studio',
    sub: 'French technique · Belgian chocolate',
    isActive: true,
  },
  {
    id: 'slide-5',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85',
    title: "Chef's Specials",
    sub: 'Open theatre, slow braises & mains',
    isActive: true,
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function assertFileStorageAllowed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JSON file storage is disabled in production. Configure PostgreSQL.');
  }
}

// ----------------------------------------------------
// 1. SESSIONS STORAGE
// ----------------------------------------------------
export function getStoredSessions(): TableSession[] {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    if (!fs.existsSync(SESSIONS_FILE)) {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading sessions file:', err);
    return [];
  }
}

export function saveStoredSessions(sessions: TableSession[]): void {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sessions file:', err);
  }
}

/**
 * Gets or atomically creates the single active session for a table.
 */
export function getOrCreateActiveSession(tableId: string, tableNumber: string, guestCount = 2): TableSession {
  const sessions = getStoredSessions();
  
  // Find open, bill_requested, or closing session
  let active = sessions.find(
    (s) => s.table_id === tableId && (s.status === 'open' || s.status === 'bill_requested' || s.status === 'closing')
  );

  if (!active) {
    const nextSessionNum = 100 + sessions.length + 1;
    active = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      table_id: tableId,
      table_number: tableNumber,
      session_number: nextSessionNum,
      status: 'open',
      guest_count: guestCount,
      opened_at: new Date().toISOString(),
      closed_at: null,
    };
    sessions.unshift(active);
    saveStoredSessions(sessions);
  }

  return active;
}

export function updateSessionStatus(sessionId: string, status: TableSession['status']): TableSession | null {
  const sessions = getStoredSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  session.status = status;
  if (status === 'settled' || status === 'cancelled') {
    session.closed_at = new Date().toISOString();
  }
  saveStoredSessions(sessions);
  return session;
}

export function settleSessionFile(
  sessionId: string,
  payments: { tender: PaymentTender; amount_paise: number; reference?: string }[],
  discountPaise = 0,
  taxPaise = 0,
  cashierId?: string
): { session: TableSession; settlement: Settlement } {
  const sessions = getStoredSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const orders = getStoredOrders().filter((o) => o.session_id === sessionId);
  const subtotalPaise = orders.reduce((sum, o) => sum + o.subtotal_paise, 0);
  const totalPaidPaise = payments.reduce((sum, p) => sum + p.amount_paise, 0);

  const settlementId = `stl-${Date.now()}`;
  const settlement: Settlement = {
    id: settlementId,
    session_id: sessionId,
    cashier_id: cashierId || 'cashier-main',
    subtotal_paise: subtotalPaise,
    discount_paise: discountPaise,
    tax_paise: taxPaise,
    total_paid_paise: totalPaidPaise,
    settled_at: new Date().toISOString(),
    payments: payments.map((p, idx) => ({
      id: `pay-${settlementId}-${idx + 1}`,
      settlement_id: settlementId,
      tender: p.tender,
      amount_paise: p.amount_paise,
      reference: p.reference || null,
      received_at: new Date().toISOString(),
    })),
  };

  session.status = 'settled';
  session.closed_at = settlement.settled_at;
  session.settlement = settlement;
  saveStoredSessions(sessions);

  // Mark all orders of this session as settled/paid
  const allOrders = getStoredOrders();
  allOrders.forEach((o) => {
    if (o.session_id === sessionId) {
      o.payment_status = 'paid';
      o.updated_at = new Date().toISOString();
    }
  });
  saveStoredOrders(allOrders);

  return { session, settlement };
}

// ----------------------------------------------------
// 2. ORDERS STORAGE
// ----------------------------------------------------
export function getStoredOrders(): StoredOrder[] {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    if (!fs.existsSync(ORDERS_FILE)) {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading orders file:', err);
    return [];
  }
}

export function saveStoredOrders(orders: StoredOrder[]): void {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving orders file:', err);
  }
}

// ----------------------------------------------------
// 3. MENU INVENTORY STORAGE
// ----------------------------------------------------
export function getStoredMenuItems(): MenuItem[] {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    if (!fs.existsSync(MENU_FILE)) {
      fs.writeFileSync(MENU_FILE, JSON.stringify(MOCK_MENU_ITEMS, null, 2), 'utf-8');
      return MOCK_MENU_ITEMS;
    }
    const data = fs.readFileSync(MENU_FILE, 'utf-8');
    const items = JSON.parse(data);
    if (!Array.isArray(items) || items.length === 0) {
      fs.writeFileSync(MENU_FILE, JSON.stringify(MOCK_MENU_ITEMS, null, 2), 'utf-8');
      return MOCK_MENU_ITEMS;
    }
    return items;
  } catch (err) {
    console.error('Error reading menu file:', err);
    return MOCK_MENU_ITEMS;
  }
}

export function saveStoredMenuItems(items: MenuItem[]): void {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    fs.writeFileSync(MENU_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving menu file:', err);
  }
}

// ----------------------------------------------------
// 4. SERVICE REQUESTS STORAGE
// ----------------------------------------------------
export function getServiceRequests(): ServiceRequest[] {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    if (!fs.existsSync(REQUESTS_FILE)) {
      fs.writeFileSync(REQUESTS_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(REQUESTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading service requests:', err);
    return [];
  }
}

export function saveServiceRequests(requests: ServiceRequest[]): void {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving service requests:', err);
  }
}

// ----------------------------------------------------
// 5. CAROUSEL SLIDES STORAGE
// ----------------------------------------------------
export function getStoredCarouselSlides(): CarouselSlide[] {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    if (!fs.existsSync(CAROUSEL_FILE)) {
      fs.writeFileSync(CAROUSEL_FILE, JSON.stringify(DEFAULT_CAROUSEL_SLIDES, null, 2), 'utf-8');
      return DEFAULT_CAROUSEL_SLIDES;
    }
    const data = fs.readFileSync(CAROUSEL_FILE, 'utf-8');
    const slides = JSON.parse(data);
    if (!Array.isArray(slides) || slides.length === 0) {
      fs.writeFileSync(CAROUSEL_FILE, JSON.stringify(DEFAULT_CAROUSEL_SLIDES, null, 2), 'utf-8');
      return DEFAULT_CAROUSEL_SLIDES;
    }
    return slides;
  } catch (err) {
    console.error('Error reading carousel file:', err);
    return DEFAULT_CAROUSEL_SLIDES;
  }
}

export function saveStoredCarouselSlides(slides: CarouselSlide[]): void {
  assertFileStorageAllowed();
  try {
    ensureDataDir();
    fs.writeFileSync(CAROUSEL_FILE, JSON.stringify(slides, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving carousel file:', err);
  }
}
