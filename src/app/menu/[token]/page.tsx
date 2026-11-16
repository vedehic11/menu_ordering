"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import { CartProvider } from "@/lib/cart-context";
import { MenuHeader } from "@/components/menu/MenuHeader";
import { CategoryNav } from "@/components/menu/CategoryNav";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { CategorySectionHeader } from "@/components/menu/CategorySectionHeader";
import { FeaturedPillsRow } from "@/components/menu/FeaturedPillsRow";
import { FloatingCartBar } from "@/components/cart/FloatingCartBar";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { ServiceRequestModal } from "@/components/menu/ServiceRequestModal";
import { CustomerBottomNav } from "@/components/menu/CustomerBottomNav";
import { DiningTable, MenuCategory, MenuItem, Restaurant, TableSession, CarouselSlide, StoredOrder } from "@/types/database";
import { Loader2, AlertCircle, RefreshCw, Receipt, X, CheckCircle2, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

function MenuContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<DiningTable | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [existingOrders, setExistingOrders] = useState<StoredOrder[]>([]);
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);
  const [billRequested, setBillRequested] = useState(false);
  const [isRequestingBill, setIsRequestingBill] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTabDrawerOpen, setIsTabDrawerOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "orders" | "bill">("menu");

  const fetchMenu = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/menu/${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load menu.");
      setRestaurant(data.restaurant);
      setTable(data.table);
      setCategories(data.categories || []);
      setItems(data.items || []);
      if (data.carouselSlides) setCarouselSlides(data.carouselSlides);

      const [ordersRes, sessRes] = await Promise.all([
        fetch(`/api/orders?tableToken=${token}`),
        fetch(`/api/sessions?tableToken=${token}`),
      ]);
      const ordersData = await ordersRes.json();
      const sessData = await sessRes.json();
      if (ordersData.orders) setExistingOrders(ordersData.orders);
      if (sessData.session) {
        setActiveSession(sessData.session);
        if (sessData.session.status === "bill_requested") setBillRequested(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load menu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void Promise.resolve().then(fetchMenu); }, [token]);

  const handleRequestFinalBill = async () => {
    if (!activeSession) return;
    setIsRequestingBill(true);
    try {
      const res = await fetch(
        `/api/sessions/${activeSession.id}/bill-request?tableToken=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      if (res.ok) setBillRequested(true);
    } catch {}
    finally { setIsRequestingBill(false); }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#171513] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1E1B18] border border-[#2C2724] flex items-center justify-center mb-5">
          <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#FDFBF7]">My, Oh My</h2>
        <p className="text-xs text-[#6F6961] mt-1 font-mono">Andheri West, Mumbai</p>
        <div className="mt-5 flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#C5A059]"
              style={{ animation: `bounce 1s ${i * 0.15}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !restaurant || !table) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🍽️</div>
        <h2 className="font-serif text-2xl font-bold text-[#1C1917] mb-2">Unable to Load Menu</h2>
        <p className="text-sm text-[#78716C] max-w-sm mb-6">
          {error || "This QR code may be inactive. Ask your captain for assistance."}
        </p>
        <button
          onClick={fetchMenu}
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1917] text-white rounded-full text-xs font-semibold hover:bg-[#C5A059] hover:text-[#171513] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    );
  }

  const unpaidRounds = existingOrders.filter((o) => o.payment_status === "pending");
  const runningTableTotalPaise = unpaidRounds.reduce((s, o) => s + o.total_paise, 0);

  const filteredItems = items.filter((item) => {
    if (activeCategoryId !== "all" && item.category_id !== activeCategoryId) return false;
    if (vegOnly && !item.is_vegetarian) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const showAll = activeCategoryId === "all" && !searchQuery.trim();

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] pb-36">

        {/* Hero + Brand Header with Carousel */}
        <MenuHeader
          restaurant={restaurant}
          table={table}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          vegOnly={vegOnly}
          onVegOnlyToggle={() => setVegOnly(!vegOnly)}
          carouselSlides={carouselSlides}
        />

        {/* Sticky Category Pills */}
        <CategoryNav
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelectCategory={setActiveCategoryId}
        />

        {/* Menu Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-10">

          {/* Chef's Picks horizontal scroll — only on "all" view */}
          {showAll && <FeaturedPillsRow items={items} />}

          {/* Empty state */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-serif text-lg font-bold text-[#1C1917]">No dishes found</p>
              <p className="text-xs text-[#78716C] mt-2 max-w-xs mx-auto">
                No items match your filters. Try clearing search or the vegetarian toggle.
              </p>
            </div>
          ) : showAll ? (
            /* Full menu grouped by category */
            categories.map((cat) => {
              const catItems = filteredItems.filter((i) => i.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-28 space-y-4">
                  <CategorySectionHeader category={cat} />
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {catItems.map((item) => <MenuItemCard key={item.id} item={item} />)}
                  </div>
                </section>
              );
            })
          ) : (
            /* Filtered / search results */
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {filteredItems.map((item) => <MenuItemCard key={item.id} item={item} />)}
            </div>
          )}
        </main>

        {/* Cart Bar (floats above bottom nav) */}
        <FloatingCartBar onOpenCheckout={() => setIsCheckoutOpen(true)} />

        {/* Bottom Nav */}
        <CustomerBottomNav
          token={token}
          tableNumber={table.table_number}
          runningTotal={runningTableTotalPaise}
          roundCount={unpaidRounds.length}
          billRequested={billRequested}
          isRequestingBill={isRequestingBill}
          onOpenMenu={() => setActiveTab("menu")}
          onViewOrders={() => { setActiveTab("orders"); setIsTabDrawerOpen(true); }}
          onCallStaff={() => setIsServiceModalOpen(true)}
          onRequestBill={() => {
            if (!billRequested && unpaidRounds.length > 0) {
              setIsTabDrawerOpen(true);
              setActiveTab("bill");
            }
          }}
          activeTab={activeTab}
        />

        {/* Modals */}
        <ServiceRequestModal isOpen={isServiceModalOpen} onClose={() => setIsServiceModalOpen(false)} table={table} />
        <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} table={table} />

        {/* Tab / Bill Drawer */}
        {isTabDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#FAF7F2] rounded-t-3xl sm:rounded-3xl border border-[#E8E2D5] p-6 w-full sm:max-w-md shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E8E2D5] pb-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1C1917]">{table.table_number} — Running Tab</h3>
                  <p className="text-xs text-[#78716C]">All dishes ordered by your party today</p>
                </div>
                <button onClick={() => { setIsTabDrawerOpen(false); setActiveTab("menu"); }} type="button"
                  className="p-1.5 rounded-xl text-[#78716C] hover:text-[#1C1917] hover:bg-[#EAE3D5] transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {billRequested && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Cashier notified
                  </div>
                  <p className="text-[11px] text-emerald-700">Please pay at the counter by cash, UPI, or card.</p>
                </div>
              )}

              {unpaidRounds.length === 0 && (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 mx-auto mb-2 text-[#D9D2C5]" />
                  <p className="text-xs text-[#A8A196]">No orders placed yet — start by picking from the menu!</p>
                </div>
              )}

              <div className="space-y-3">
                {unpaidRounds.map((ord) => {
                  const ordItems = ord.items || [];
                  const statusColors: Record<string, string> = {
                    received: "bg-blue-100 text-blue-800", accepted: "bg-amber-100 text-amber-800",
                    preparing: "bg-orange-100 text-orange-800", ready: "bg-green-100 text-green-800",
                    served: "bg-emerald-100 text-emerald-800",
                  };
                  const status = ord.kitchen_status || ord.order_status || "received";
                  return (
                    <div key={ord.id} className="p-4 bg-white rounded-2xl border border-[#E8E2D5] text-xs space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#987532] font-serif text-sm">Order #{ord.order_number}</span>
                        <span className={`uppercase text-[10px] px-2.5 py-1 rounded-full font-bold font-mono ${statusColors[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>
                      </div>
                      <div className="space-y-1.5">
                        {ordItems.map((i, iIdx) => (
                          <div key={iIdx} className="flex justify-between text-[#1C1917]">
                            <span>{i.quantity}× {i.item_name}</span>
                            <span className="font-medium">{formatCurrency(i.line_total_paise || i.unit_price_paise * i.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-[#F5F2EB] flex justify-between font-bold">
                        <span>Round Total</span>
                        <span>{formatCurrency(ord.total_paise || ord.subtotal_paise)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {runningTableTotalPaise > 0 && (
                <div className="p-4 bg-[#171513] rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#A8A196] block uppercase font-bold font-mono tracking-wider">Total Table Due</span>
                    <span className="text-2xl font-bold font-serif text-[#DFC894]">{formatCurrency(runningTableTotalPaise)}</span>
                  </div>
                  <span className="text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#A8A196] font-mono">Pay at Counter</span>
                </div>
              )}

              {!billRequested && unpaidRounds.length > 0 && (
                <button type="button" disabled={isRequestingBill} onClick={handleRequestFinalBill}
                  className="w-full py-3.5 rounded-2xl bg-[#C5A059] hover:bg-[#B8923F] text-[#171513] text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-60">
                  <Banknote className="w-4 h-4" />
                  {isRequestingBill ? "Requesting…" : "Request Final Bill & Pay at Counter"}
                </button>
              )}

              <button type="button" onClick={() => { setIsTabDrawerOpen(false); setActiveTab("menu"); }}
                className="w-full py-2.5 rounded-2xl bg-[#F5F2EB] text-[#1C1917] text-xs font-semibold hover:bg-[#EAE3D5] cursor-pointer transition">
                ← Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </CartProvider>
  );
}

export default function MenuPage(props: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#171513] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" />
      </div>
    }>
      <MenuContent {...props} />
    </Suspense>
  );
}
