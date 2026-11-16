"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  ChefHat,
  RefreshCw,
  Award,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { StoredOrder, TableSession } from "@/types/database";

export default function AnalyticsDashboard() {
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [tableCount, setTableCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchStats = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [sessRes, ordersRes, tablesRes] = await Promise.all([
        fetch("/api/sessions", { cache: "no-store" }),
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/tables", { cache: "no-store" }),
      ]);
      const [sessData, ordersData, tablesData] = await Promise.all([
        sessRes.json(),
        ordersRes.json(),
        tablesRes.json(),
      ]);
      if (!sessRes.ok) throw new Error(sessData.error || "Unable to load sessions.");
      if (!ordersRes.ok) throw new Error(ordersData.error || "Unable to load orders.");
      if (!tablesRes.ok) throw new Error(tablesData.error || "Unable to load dining tables.");
      if (!Array.isArray(sessData.sessions) || !Array.isArray(ordersData.orders) || !Array.isArray(tablesData.tables)) {
        throw new Error("Operations data was not in the expected format.");
      }

      setSessions(sessData.sessions);
      setOrders(ordersData.orders);
      setTableCount(tablesData.tables.length);
      setLastUpdated(new Date().toISOString());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to update operations metrics.");
      console.error("Dashboard error:", loadError);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => fetchStats());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchStats();
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchStats();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchStats]);

  // Compute metrics
  const activeSessions = sessions.filter((s) => ["open", "bill_requested", "closing"].includes(s.status));
  const settledSessions = sessions.filter((s) => s.status === "settled");

  const totalRevenuePaise = orders.reduce((sum, o) => sum + (o.total_paise || o.subtotal_paise), 0);
  const settledRevenuePaise = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + (o.total_paise || o.subtotal_paise), 0);
  const unsettledRevenuePaise = totalRevenuePaise - settledRevenuePaise;

  // Station breakdown
  const stationCounts: Record<string, number> = {
    robata: 0,
    pizza: 0,
    mains: 0,
    bar: 0,
    pastry: 0,
  };

  const itemCounts: Record<string, { name: string; count: number; totalPaise: number }> = {};

  orders.forEach((ord) => {
    (ord.items || []).forEach((item) => {
      if (item.station && stationCounts[item.station] !== undefined) {
        stationCounts[item.station] += item.quantity;
      }
      if (!itemCounts[item.item_name]) {
        itemCounts[item.item_name] = { name: item.item_name, count: 0, totalPaise: 0 };
      }
      itemCounts[item.item_name].count += item.quantity;
      itemCounts[item.item_name].totalPaise += item.line_total_paise || item.unit_price_paise * item.quantity;
    });
  });

  const topDishes = Object.values(itemCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
      <AdminNav />

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-20 pb-28 sm:px-6 md:py-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D5]">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#171513]">
              Operations & Shift Analytics
            </h1>
            <p className="text-xs text-[#6F6961] mt-0.5">
              Real-time shift totals • Dining zone occupancy • Station throughput
            </p>
          </div>

          <button
            onClick={() => void fetchStats(true)}
            type="button"
            disabled={isLoading || isRefreshing}
            className="inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2] transition-colors cursor-pointer self-start sm:self-auto disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#987532] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Updating…" : "Sync now"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#8C827A]" aria-live="polite">
            {isLoading ? "Loading live operations data…" : lastUpdated ? `Last synced ${new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
          {error && (
            <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <span>{error}</span>
              <button type="button" onClick={() => void fetchStats(true)} className="font-semibold underline">Retry</button>
            </div>
          )}
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#EAE3D5] shadow-xs space-y-1">
            <span className="text-[11px] font-mono text-[#A8A196] uppercase font-bold">
              Total F&B Volume
            </span>
            <div className="font-serif text-2xl font-bold text-[#171513]">
              {formatCurrency(totalRevenuePaise)}
            </div>
            <p className="text-[11px] text-[#6F6961] font-mono">
              Across {orders.length} orders
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3D5] shadow-xs space-y-1">
            <span className="text-[11px] font-mono text-[#A8A196] uppercase font-bold">
              Settled at Counter
            </span>
            <div className="font-serif text-2xl font-bold text-emerald-700">
              {formatCurrency(settledRevenuePaise)}
            </div>
            <p className="text-[11px] text-emerald-800 font-mono">
              {settledSessions.length} closed tables
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3D5] shadow-xs space-y-1">
            <span className="text-[11px] font-mono text-[#A8A196] uppercase font-bold">
              Unsettled Table Tabs
            </span>
            <div className="font-serif text-2xl font-bold text-[#987532]">
              {formatCurrency(unsettledRevenuePaise)}
            </div>
            <p className="text-[11px] text-[#987532] font-mono">
              Active running guest tabs
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3D5] shadow-xs space-y-1">
            <span className="text-[11px] font-mono text-[#A8A196] uppercase font-bold">
              Table Occupancy
            </span>
            <div className="font-serif text-2xl font-bold text-[#171513]">
              {activeSessions.length} / {tableCount}
            </div>
            <p className="text-[11px] text-[#6F6961] font-mono">
              {tableCount === 0 ? 0 : Math.round((activeSessions.length / tableCount) * 100)}% capacity currently seated
            </p>
          </div>
        </div>

        {/* Station Throughput & Top Dishes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Station Line Throughput */}
          <div className="bg-white p-6 rounded-3xl border border-[#EAE3D5] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#987532]" />
              <h3 className="font-serif font-bold text-lg text-[#171513]">
                Kitchen Station Throughput
              </h3>
            </div>
            <p className="text-xs text-[#6F6961]">
              Dishes prepared across the live line today
            </p>

            <div className="space-y-3 pt-2">
              {[
                { name: "Live Robata & Skewers", key: "robata", color: "bg-red-500" },
                { name: "Wood-Fired Sourdough Pizza", key: "pizza", color: "bg-amber-500" },
                { name: "Chef's Live Mains", key: "mains", color: "bg-emerald-600" },
                { name: "Craft Botanical Bar", key: "bar", color: "bg-blue-500" },
                { name: "Pastry Studio Desserts", key: "pastry", color: "bg-purple-500" },
              ].map((st) => {
                const count = stationCounts[st.key] || 0;
                const totalItems = Object.values(stationCounts).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / totalItems) * 100);

                return (
                  <div key={st.key} className="space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span className="text-[#171513] font-semibold">{st.name}</span>
                      <span className="text-[#6F6961]">{count} dishes ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#FAF7F2] border border-[#EAE3D5] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${st.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Dishes Ordered */}
          <div className="bg-white p-6 rounded-3xl border border-[#EAE3D5] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#987532]" />
              <h3 className="font-serif font-bold text-lg text-[#171513]">
                Guest Favorites & Top Sellers
              </h3>
            </div>
            <p className="text-xs text-[#6F6961]">
              Most ordered creations at My, Oh My
            </p>

            {topDishes.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#A8A196] font-mono">
                No dishes recorded yet today.
              </div>
            ) : (
              <div className="divide-y divide-[#EAE3D5] pt-2">
                {topDishes.map((dish, idx) => (
                  <div key={dish.name} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#FAF7F2] border border-[#D9D2C5] flex items-center justify-center font-bold font-mono text-[10px] text-[#987532]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-[#171513]">{dish.name}</span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-[#171513]">{dish.count} ordered</span>
                      <span className="text-[10px] text-[#6F6961] block">{formatCurrency(dish.totalPaise)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
