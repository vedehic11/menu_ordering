"use client";

import React, { useCallback, useEffect, useState, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ArrowLeft,
  Receipt,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface OrderLineItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
}

interface OrderDetail {
  id: string;
  order_number: number;
  table_id: string;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  special_instructions: string | null;
  created_at: string;
  table_number?: string;
  dining_tables?: { table_number: string; qr_token?: string };
  customer?: { name: string; phone: string; email: string };
  customers?: { name: string; phone: string; email: string };
  items?: OrderLineItem[];
  order_items?: OrderLineItem[];
}

function OrderStatusContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tableToken = useSearchParams().get("tableToken");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [tableOrders, setTableOrders] = useState<OrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const orderParams = new URLSearchParams({ id });
      if (tableToken) orderParams.set("tableToken", tableToken);
      const res = await fetch(`/api/orders?${orderParams.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.order) {
        throw new Error(data.error || "Order not found");
      }
      setOrder(data.order);

      if (tableToken) {
        const tableRes = await fetch(
          `/api/orders?tableToken=${encodeURIComponent(tableToken)}`,
        );
        const tableData = await tableRes.json();
        if (tableData.orders) setTableOrders(tableData.orders);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load order";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id, tableToken]);

  useEffect(() => {
    void Promise.resolve().then(fetchOrder);
    const interval = setInterval(fetchOrder, 3500);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white border border-[#E8E2D5] flex items-center justify-center shadow-sm mb-4">
          <Clock className="w-6 h-6 animate-spin text-[#C5A059]" />
        </div>
        <h2 className="font-serif text-xl font-bold text-[#1C1917]">
          Retrieving Order Details...
        </h2>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#1C1917] mb-2">
          Order Not Found
        </h2>
        <p className="text-sm text-[#78716C] max-w-sm mb-6">
          {error || "We could not find this order number. Please verify with your service staff."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1917] text-white rounded-full text-xs font-semibold hover:bg-[#33302B] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>
      </div>
    );
  }

  const tableNumber =
    order.table_number || order.dining_tables?.table_number || "Table";
  const customerInfo = order.customer || order.customers;
  const ordersToDisplay = tableOrders.some((tableOrder) => tableOrder.id === order.id)
    ? tableOrders
    : [...tableOrders, order];
  const orderedItemsByKey = new Map<string, OrderLineItem>();
  ordersToDisplay.forEach((tableOrder) => {
    (tableOrder.items || tableOrder.order_items || []).forEach((item) => {
      const key = `${item.item_name}:${item.unit_price_paise}`;
      const existing = orderedItemsByKey.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.line_total_paise += item.line_total_paise || item.unit_price_paise * item.quantity;
      } else {
        orderedItemsByKey.set(key, { ...item });
      }
    });
  });
  const orderedItems = Array.from(orderedItemsByKey.values());

  // Compute table total
  const runningTableTotalPaise = ordersToDisplay.reduce(
    (sum, o) => sum + o.total_paise,
    0
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] py-8 px-4 sm:px-6 lg:px-8">
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent opacity-80" />

      <main className="max-w-2xl mx-auto space-y-6">
        {/* Top Success Banner */}
        <section aria-label="Order confirmation" className="bg-white rounded-3xl border border-[#E8E2D5] p-6 sm:p-8 text-center shadow-[0_4px_24px_rgba(28,25,23,0.06)] relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-[#F3EFE6] text-[#C5A059] flex items-center justify-center mx-auto mb-4 border border-[#E8E2D5]">
            <CheckCircle2 className="w-8 h-8 text-[#16A34A]" />
          </div>

          <span className="text-xs font-bold uppercase tracking-widest text-[#987532]">
            Order placed
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1917] mt-1">
            Order #{order.order_number}
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] mt-1">
            Serving at <strong className="text-[#1C1917]">{tableNumber}</strong>
          </p>
        </section>

        {/* Order more items for the same table */}
        <div className="bg-[#1C1917] rounded-3xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border border-[#33302B]">
          <div>
            <div className="text-xs text-[#DFC894] font-semibold uppercase tracking-wider">
              Want anything else?
            </div>
            <div className="text-sm font-medium text-[#FAF7F2] mt-0.5">
              Add more food or drinks to your table order.
            </div>
          </div>

          <Link
            href={tableToken ? `/menu/${encodeURIComponent(tableToken)}` : "/"}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#DFC894] text-[#1C1917] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <span>Order more</span>
          </Link>
        </div>

        {ordersToDisplay.length > 0 && (
          <div className="bg-white rounded-3xl border border-[#E8E2D5] p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#987532]">
                  Ordered for {tableNumber}
                </span>
                <div className="text-lg font-bold text-[#1C1917]">
                  {formatCurrency(runningTableTotalPaise || order.total_paise)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All items remain visible regardless of kitchen status */}
        <div className="bg-white rounded-3xl border border-[#E8E2D5] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#F5F2EB] pb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#C5A059]" />
              <h3 className="font-serif text-lg font-bold text-[#1C1917]">
                Your ordered items
              </h3>
            </div>
          </div>

          <div className="divide-y divide-[#F5F2EB]">
            {orderedItems.map((item) => (
              <div key={`${item.item_name}:${item.unit_price_paise}`} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium text-[#1C1917]">
                    <span className="font-bold text-[#987532] mr-2">
                      {item.quantity}×
                    </span>
                    {item.item_name}
                  </div>
                  <div className="text-xs text-[#78716C] mt-0.5">
                    {formatCurrency(item.unit_price_paise)} each
                  </div>
                </div>
                <div className="font-semibold text-[#1C1917]">
                  {formatCurrency(item.line_total_paise || item.unit_price_paise * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {/* Pay at Counter Notice */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8E2D5] flex items-start gap-3">
            <Banknote className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-[#1C1917] block">
                Pay at Billing Counter Upon Leaving
              </span>
              <p className="text-[#78716C] mt-0.5">
                Everything ordered for {tableNumber} is added to your table bill. Settle via Cash, UPI, or Card at the billing counter when you finish.
              </p>
            </div>
          </div>
        </div>

        {/* Guest Information */}
        {customerInfo && (
          <div className="bg-white rounded-3xl border border-[#E8E2D5] p-5 shadow-xs flex items-center justify-between text-xs text-[#78716C]">
            <div>
              <span className="text-[#A8A29E] block uppercase tracking-wider font-semibold">Guest</span>
              <strong className="text-[#1C1917] text-sm">{customerInfo.name}</strong>
              <div className="mt-0.5">{customerInfo.phone} • {customerInfo.email}</div>
            </div>
            <Link
              href="/admin"
              className="text-xs text-[#C5A059] hover:underline font-semibold"
            >
              Staff View &rarr;
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default function OrderStatusPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
          <Clock className="w-8 h-8 animate-spin text-[#C5A059]" />
        </div>
      }
    >
      <OrderStatusContent {...props} />
    </Suspense>
  );
}
