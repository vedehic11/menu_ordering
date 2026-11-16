"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { playKitchenChime } from "@/lib/sound";
import { StoredOrder } from "@/types/database";

export default function KitchenDisplaySystem() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<"incoming" | "completed">("incoming");
  const [error, setError] = useState<string | null>(null);
  const prevOrdersCount = useRef(0);

  const fetchKitchenOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to load kitchen orders.");
      }

      const fetchedOrders: StoredOrder[] = data.orders || [];
      if (
        prevOrdersCount.current > 0 &&
        fetchedOrders.length > prevOrdersCount.current &&
        soundEnabled
      ) {
        playKitchenChime();
      }
      prevOrdersCount.current = fetchedOrders.length;
      setOrders(fetchedOrders);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load kitchen orders.";
      setError(message);
      console.error("Kitchen fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [soundEnabled]);

  useEffect(() => {
    void Promise.resolve().then(fetchKitchenOrders);
    const timer = setInterval(fetchKitchenOrders, 3500);
    return () => clearInterval(timer);
  }, [fetchKitchenOrders]);

  const handleMarkDone = async (orderId: string, itemId: string) => {
    setUpdatingItemId(itemId);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, itemId, isDone: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to mark this dish done.");
      }
      setOrders((current) =>
        current.map((order) => {
          if (order.id !== orderId) return order;
          return {
            ...order,
            kitchen_status: data.order.kitchen_status,
            order_status: data.order.kitchen_status,
            items: order.items.map((item) =>
              item.id === itemId ? { ...item, is_done: true } : item,
            ),
          };
        }),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to mark this dish done.";
      setError(message);
      console.error("Failed to mark dish done:", err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const incomingOrders = orders.filter(
    (order) =>
      order.kitchen_status !== "served" &&
      order.kitchen_status !== "cancelled" &&
      order.items.some((item) => !item.is_voided && !item.is_done),
  );
  const completedOrders = orders.filter(
    (order) =>
      order.kitchen_status !== "cancelled" &&
      (order.kitchen_status === "served" || order.items.some((item) => item.is_done)),
  );
  const visibleOrders = selectedQueue === "incoming" ? incomingOrders : completedOrders;
  const cancelledOrders = orders.filter((order) => order.kitchen_status === "cancelled");
  const unfinishedItemCount = incomingOrders.reduce(
    (total, order) =>
      total + order.items.filter((item) => !item.is_voided && !item.is_done).length,
    0,
  );
  const completedItemCount = completedOrders.reduce(
    (total, order) =>
      total +
      order.items.filter((item) => !item.is_voided && (order.kitchen_status === "served" || item.is_done)).length,
    0,
  );

  return (
    <div className="min-h-screen bg-[#141210] text-[#FAF7F2]">
      <AdminNav
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((enabled) => !enabled)}
      />

      <main className="mx-auto min-w-0 max-w-5xl space-y-6 px-3 pt-20 pb-28 sm:space-y-8 sm:px-6 md:py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#2C2724] pb-5 xl:flex-row xl:items-center xl:justify-between xl:gap-4 xl:pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#DFC894]/25 bg-[#DFC894]/10">
                <ChefHat className="h-5 w-5 text-[#DFC894]" />
              </span>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight text-[#FAF7F2] sm:text-3xl">
                  Kitchen
                </h1>
                <p className="mt-0.5 text-xs text-[#8F877B] sm:text-sm">Incoming orders and completed dishes</p>
              </div>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 xl:w-auto">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <div className="min-w-0 rounded-xl border border-[#3E3834] bg-[#1B1816] px-2 py-2 sm:px-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8F877B]">Orders</p>
                <p className="mt-0.5 text-lg font-black leading-none text-[#FAF7F2]">{incomingOrders.length}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-[#DFC894]/20 bg-[#2A241A] px-2 py-2 sm:px-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#BBA574]">Items to finish</p>
                <p className="mt-0.5 text-lg font-black leading-none text-[#DFC894]">{unfinishedItemCount}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => void fetchKitchenOrders()}
                type="button"
                aria-label="Refresh orders"
                title="Refresh orders"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#3E3834] bg-[#221E1C] text-[#A8A196] hover:text-[#FAF7F2] touch-manipulation"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section aria-labelledby="incoming-orders-heading" className="space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="incoming-orders-heading" className="text-lg font-bold text-[#FAF7F2] sm:text-xl">
                {selectedQueue === "incoming" ? "Incoming orders" : "Completed dishes"}
              </h2>
              <p className="mt-0.5 text-xs text-[#8F877B] sm:text-sm">
                {selectedQueue === "incoming"
                  ? "Mark each item done as it reaches the table."
                  : "Dishes marked done appear here."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
              <div className="inline-flex rounded-xl border border-[#3E3834] bg-[#1B1816] p-1" role="group" aria-label="Kitchen order view">
                <button
                  type="button"
                  aria-pressed={selectedQueue === "incoming"}
                  onClick={() => setSelectedQueue("incoming")}
                  className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors touch-manipulation sm:px-4 sm:text-sm ${
                    selectedQueue === "incoming"
                      ? "bg-[#DFC894] text-[#171513]"
                      : "text-[#A8A196] hover:text-[#FAF7F2]"
                  }`}
                >
                  Incoming <span className="ml-1 opacity-75">{incomingOrders.length}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={selectedQueue === "completed"}
                  onClick={() => setSelectedQueue("completed")}
                  className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors touch-manipulation sm:px-4 sm:text-sm ${
                    selectedQueue === "completed"
                      ? "bg-emerald-600 text-white"
                      : "text-[#A8A196] hover:text-[#FAF7F2]"
                  }`}
                >
                  Completed <span className="ml-1 opacity-75">{completedItemCount}</span>
                </button>
              </div>
              {selectedQueue === "incoming" && incomingOrders.length > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#DFC894]/25 bg-[#DFC894]/10 px-3 py-1.5 text-xs font-bold text-[#DFC894]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Auto-updating
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-[#A8A196]">Loading orders…</div>
          ) : visibleOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#3E3834] bg-[#1A1715] py-12 text-center">
              {selectedQueue === "completed"
                ? <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[#6F6961]" />
                : <ChefHat className="mx-auto mb-3 h-10 w-10 text-[#6F6961]" />}
              <p className="font-semibold text-[#FAF7F2]">
                {selectedQueue === "incoming" ? "No incoming orders" : "No completed dishes yet"}
              </p>
              <p className="mt-1 text-sm text-[#A8A196]">
                {selectedQueue === "incoming"
                  ? "New orders will show here automatically."
                  : "Dishes marked done will show here."}
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {visibleOrders.map((order) => (
                <article
                  key={order.id}
                  className={`overflow-hidden rounded-3xl border bg-[#1B1816] shadow-[0_12px_36px_rgba(0,0,0,0.2)] transition-colors ${
                    selectedQueue === "completed"
                      ? "border-emerald-900/50"
                      : "border-[#3B342A] hover:border-[#665638]"
                  }`}
                >
                  <div className={`grid grid-cols-[minmax(0,1fr)_78px] gap-3 border-b p-3.5 sm:grid-cols-[minmax(0,1fr)_108px] sm:gap-5 sm:p-5 ${
                    selectedQueue === "completed"
                      ? "border-emerald-900/40 bg-gradient-to-r from-[#17231D] to-[#1B1816]"
                      : "border-[#342E28] bg-gradient-to-r from-[#282117] to-[#1B1816]"
                  }`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-black sm:text-sm ${
                          selectedQueue === "completed"
                            ? "border-emerald-700/40 bg-emerald-900/30 text-emerald-300"
                            : "border-[#DFC894]/25 bg-[#DFC894]/10 text-[#DFC894]"
                        }`}>
                          {selectedQueue === "completed"
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <BellRing className="h-3.5 w-3.5" />}
                          Order #{order.order_number}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#151311]/70 px-2.5 py-1.5 text-xs font-medium text-[#B9B0A3] sm:text-sm">
                          <Clock className="h-3.5 w-3.5 text-[#DFC894]" />
                          {formatDate(order.created_at)}
                        </span>
                      </div>

                    </div>

                    <div className="flex items-start justify-end">
                      <div
                        aria-label={order.table_number.split(" • ")[0]}
                        className="flex aspect-square w-[72px] flex-col items-center justify-center rounded-full border-2 border-[#C5A059] bg-[#302619] text-center shadow-[inset_0_0_0_4px_rgba(197,160,89,0.08)] sm:w-24"
                      >
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#DFC894] sm:text-[10px]">
                          Table
                        </span>
                        <span className="text-2xl font-black leading-tight text-white sm:text-3xl">
                          {order.table_number.split(" • ")[0].replace(/^Table\s*/i, "")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-3.5 sm:space-y-2.5 sm:p-5">
                    {(order.items || []).filter((item) =>
                      !item.is_voided &&
                      (selectedQueue === "incoming"
                        ? !item.is_done
                        : order.kitchen_status === "served" || item.is_done),
                    ).map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2.5 rounded-2xl border p-2.5 sm:gap-3 sm:p-3 ${
                          selectedQueue === "completed"
                            ? "border-emerald-900/50 bg-emerald-950/20"
                            : "border-[#332D27] bg-[#211D1A]"
                        }`}
                      >
                        <span className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-base font-black sm:h-12 sm:min-w-12 sm:text-lg ${
                          selectedQueue === "completed" ? "bg-emerald-900/40 text-emerald-300" : "bg-[#3A3023] text-[#DFC894]"
                        }`}>
                          {item.quantity}×
                        </span>
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className={`text-sm font-bold leading-snug sm:text-base ${
                            selectedQueue === "completed" ? "text-emerald-100/80" : "text-[#FAF7F2]"
                          }`}>
                            {item.item_name}
                          </p>
                          {item.special_instructions && (
                            <p className="mt-1 rounded-lg border-l-2 border-amber-500/70 bg-amber-950/25 px-2 py-1 text-xs leading-relaxed text-amber-100 sm:text-sm">
                              {item.special_instructions}
                            </p>
                          )}
                        </div>
                        {selectedQueue === "completed" ? (
                          <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-900/40 px-3 text-xs font-extrabold text-emerald-300 sm:px-4 sm:text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Done
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={updatingItemId === item.id}
                            onClick={() => void handleMarkDone(order.id, item.id)}
                            className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-extrabold text-white shadow-[0_4px_12px_rgba(5,150,105,0.16)] transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-wait disabled:opacity-70 touch-manipulation sm:min-w-28 sm:px-4 sm:text-sm"
                          >
                            {updatingItemId === item.id ? "Saving…" : "Mark done"}
                          </button>
                        )}
                      </div>
                    ))}

                    {order.special_instructions && (
                      <p className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-100 sm:text-sm">
                        <strong className="text-amber-300">Table note:</strong>{" "}
                        {order.special_instructions}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {cancelledOrders.length > 0 && (
          <section aria-labelledby="cancelled-orders-heading" className="space-y-3 border-t border-[#2C2724] pt-6">
            <h2 id="cancelled-orders-heading" className="text-sm font-bold uppercase tracking-wide text-[#A8A196]">
              Cancelled ({cancelledOrders.length})
            </h2>
            {cancelledOrders.map((order) => (
              <article key={order.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#2C2724] bg-[#1A1715] px-4 py-3 text-sm">
                <strong className="sm:w-56 text-[#DFC894]">{order.table_number.split(" • ")[0]}</strong>
                <span className="sm:w-28 text-[#A8A196]">Order #{order.order_number}</span>
                <span className="flex-1 text-[#FAF7F2]">
                  {(order.items || []).map((item) => `${item.quantity}× ${item.item_name}`).join(", ")}
                </span>
                <span className="text-red-300">Cancelled</span>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
