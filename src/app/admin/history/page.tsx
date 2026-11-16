"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { formatCurrency } from "@/lib/formatters";
import type { PaymentTender, SessionStatus } from "@/types/database";

interface HistoryOrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
  is_voided: boolean;
  void_reason: string | null;
}

interface HistoryOrder {
  id: string;
  order_number: number;
  kitchen_status: string;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  created_at: string;
  customer_name: string;
  items: HistoryOrderItem[];
}

interface HistoryPayment {
  tender: PaymentTender;
  amount_paise: number;
  reference: string | null;
  received_at: string;
}

interface HistorySession {
  id: string;
  table_id: string;
  table_number: string;
  session_number: number;
  status: SessionStatus;
  guest_count: number;
  opened_at: string;
  closed_at: string | null;
  orders: HistoryOrder[];
  settlement: {
    invoice_number: string | null;
    subtotal_paise: number;
    discount_paise: number;
    tax_paise: number;
    total_paid_paise: number;
    settled_at: string;
    payments: HistoryPayment[];
  } | null;
}

interface HistoryTable {
  id: string;
  table_number: string;
}

interface HistoryResponse {
  sessions: HistorySession[];
  tables: HistoryTable[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface HistoryFilters {
  tableId: string;
  status: string;
  from: string;
  to: string;
  search: string;
}

const EMPTY_FILTERS: HistoryFilters = { tableId: "", status: "all", from: "", to: "", search: "" };

const STATUS_LABELS: Record<SessionStatus, string> = {
  open: "Open",
  bill_requested: "Bill requested",
  closing: "Closing",
  settled: "Settled",
  cancelled: "Cancelled",
};

function statusClasses(status: SessionStatus) {
  if (status === "settled") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "cancelled") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-900 border-amber-200";
}

function formatVisitDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminHistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const loadHistory = useCallback(async (page = 1, activeFilters = filters) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (activeFilters.tableId) params.set("tableId", activeFilters.tableId);
      if (activeFilters.status !== "all") params.set("status", activeFilters.status);
      if (activeFilters.from) params.set("from", activeFilters.from);
      if (activeFilters.to) params.set("to", activeFilters.to);
      if (activeFilters.search.trim()) params.set("search", activeFilters.search.trim());

      const response = await fetch(`/api/admin/history?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load visit history.");
      setData(body as HistoryResponse);
      setExpandedSession(null);
    } catch (loadError) {
      console.error("Admin history fetch error:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load visit history.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void Promise.resolve().then(() => loadHistory(1));
  }, [loadHistory]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setIsDateFilterOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
      <AdminNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-20 md:px-8 md:pb-10 md:pt-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#987532]">
              <HistoryIcon className="h-4 w-4" />
              Restaurant records
            </div>
            <h1 className="font-serif text-3xl font-bold">Visit history</h1>
            <p className="mt-1 text-sm text-[#6F6961]">
              Completed and current table visits, orders, bills, and recorded payments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory(data?.page || 1)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EAE3D5] bg-white px-4 py-2.5 text-sm font-semibold text-[#514A42] hover:border-[#C5A059] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <form onSubmit={applyFilters} className="rounded-2xl border border-[#EAE3D5] bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-[minmax(220px,1fr)_150px_150px_auto_auto_auto]">
            <label className="relative col-span-2 min-w-0 xl:col-span-1">
              <span className="sr-only">Search table, invoice, or guest</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A196]" />
            <input
              value={draftFilters.search}
              onChange={(event) => setDraftFilters({ ...draftFilters, search: event.target.value })}
                aria-label="Search table, invoice, or guest"
                placeholder="Search history"
                className="h-10 w-full rounded-lg border border-[#EAE3D5] bg-[#FDFBF7] pl-9 pr-3 text-sm outline-none focus:border-[#C5A059]"
            />
            </label>
            <select
              value={draftFilters.tableId}
              onChange={(event) => setDraftFilters({ ...draftFilters, tableId: event.target.value })}
                aria-label="Filter by table"
                className="h-10 min-w-0 w-full rounded-lg border border-[#EAE3D5] bg-[#FDFBF7] px-2 text-sm outline-none focus:border-[#C5A059] sm:px-3"
            >
              <option value="">All tables</option>
              {(data?.tables || []).map((table) => (
                <option key={table.id} value={table.id}>{table.table_number}</option>
              ))}
            </select>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value })}
                aria-label="Filter by visit status"
                className="h-10 min-w-0 w-full rounded-lg border border-[#EAE3D5] bg-[#FDFBF7] px-2 text-sm outline-none focus:border-[#C5A059] sm:px-3"
            >
              <option value="all">All visits</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="col-span-2 flex gap-2 xl:col-span-3">
              <button
                type="button"
                aria-expanded={isDateFilterOpen}
                onClick={() => setIsDateFilterOpen((open) => !open)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                  isDateFilterOpen || draftFilters.from || draftFilters.to
                    ? "border-[#C5A059] bg-[#FBF9F4] text-[#765B2B]"
                    : "border-[#EAE3D5] text-[#514A42] hover:bg-[#FDFBF7]"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                <span>Dates</span>
                {(draftFilters.from || draftFilters.to) && <span className="h-1.5 w-1.5 rounded-full bg-[#987532]" />}
              </button>
              <button
                type="submit"
                aria-label="Apply filters"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171513] px-3 text-sm font-semibold text-white hover:bg-[#302A25]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Apply</span>
              </button>
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Clear filters"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#EAE3D5] px-3 text-sm font-semibold text-[#514A42] hover:bg-[#FDFBF7]"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>
          {isDateFilterOpen && (
            <div className="mt-2 grid gap-2 border-t border-[#F0EBE2] pt-3 sm:grid-cols-2">
              <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#6F6961]">
                <span className="w-10 shrink-0">From</span>
                <input
                  type="date"
                  value={draftFilters.from}
                  max={draftFilters.to || undefined}
                  onChange={(event) => setDraftFilters({ ...draftFilters, from: event.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#EAE3D5] bg-[#FDFBF7] px-2 text-sm font-normal outline-none focus:border-[#C5A059]"
                />
              </label>
              <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#6F6961]">
                <span className="w-10 shrink-0">To</span>
                <input
                  type="date"
                  value={draftFilters.to}
                  min={draftFilters.from || undefined}
                  onChange={(event) => setDraftFilters({ ...draftFilters, to: event.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#EAE3D5] bg-[#FDFBF7] px-2 text-sm font-normal outline-none focus:border-[#C5A059]"
                />
              </label>
            </div>
          )}
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#EAE3D5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F0EBE2] px-4 py-4 sm:px-6">
            <div>
              <h2 className="font-serif text-lg font-bold">Table visits</h2>
              <p className="text-xs text-[#6F6961]">
                {data ? `${data.total} ${data.total === 1 ? "visit" : "visits"} found` : "Loading records"}
              </p>
            </div>
            {isLoading && <span className="text-xs text-[#6F6961]">Loading…</span>}
          </div>

          {error ? (
            <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
              <button type="button" onClick={() => void loadHistory(data?.page || 1)} className="ml-3 font-semibold underline">
                Try again
              </button>
            </div>
          ) : !isLoading && data?.sessions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <HistoryIcon className="mx-auto mb-3 h-8 w-8 text-[#A8A196]" />
              <p className="font-semibold">No visits match these filters</p>
              <p className="mt-1 text-sm text-[#6F6961]">Clear one or more filters to see other table history.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0EBE2]">
              {(data?.sessions || []).map((session) => {
                const isExpanded = expandedSession === session.id;
                const subtotal = session.orders.reduce((sum, order) => sum + order.subtotal_paise, 0);
                return (
                  <article key={session.id}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-4 text-left hover:bg-[#FDFBF7] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-serif text-base font-bold">{session.table_number}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClasses(session.status)}`}>
                            {STATUS_LABELS[session.status]}
                          </span>
                          {session.settlement?.invoice_number && (
                            <span className="text-xs text-[#6F6961]">{session.settlement.invoice_number}</span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-[#6F6961]">
                          {formatVisitDate(session.opened_at)}
                          {session.closed_at ? ` · Closed ${formatVisitDate(session.closed_at)}` : " · Still open"}
                        </span>
                      </span>
                      <span className="col-start-1 row-start-2 text-xs text-[#6F6961] sm:col-start-auto sm:row-start-auto sm:text-right">
                        {session.orders.length} {session.orders.length === 1 ? "order" : "orders"}
                        <span className="block">{session.guest_count} guests</span>
                      </span>
                      <span className="col-start-2 row-start-2 text-right font-semibold text-[#171513] sm:col-start-auto sm:row-start-auto">
                        {formatCurrency(session.settlement?.total_paid_paise ?? subtotal)}
                        <span className="block text-[10px] font-normal text-[#6F6961]">
                          {session.settlement ? "Paid" : "Order subtotal"}
                        </span>
                      </span>
                      <ChevronDown className={`col-start-2 row-start-1 h-4 w-4 justify-self-end text-[#6F6961] sm:col-start-auto sm:row-auto ${isExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="space-y-4 bg-[#FDFBF7] px-4 pb-5 pt-1 sm:px-6">
                        {session.orders.length === 0 ? (
                          <p className="text-sm text-[#6F6961]">No orders were recorded for this visit.</p>
                        ) : (
                          session.orders.map((order) => (
                            <div key={order.id} className="rounded-xl border border-[#EAE3D5] bg-white p-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold">Order #{order.order_number}</span>
                                <span className="text-xs text-[#6F6961]">
                                  {order.customer_name ? `${order.customer_name} · ` : ""}{formatVisitDate(order.created_at)}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {order.items.map((item) => (
                                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                                    <span className={item.is_voided ? "text-[#8A8177] line-through" : "text-[#514A42]"}>
                                      {item.quantity}× {item.item_name}
                                      {item.is_voided && <span className="ml-2 text-xs no-underline">Voided{item.void_reason ? `: ${item.void_reason}` : ""}</span>}
                                    </span>
                                    <span className="shrink-0">{formatCurrency(item.line_total_paise)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex justify-end border-t border-[#F0EBE2] pt-2 text-sm font-semibold">
                                Order subtotal: {formatCurrency(order.subtotal_paise)}
                              </div>
                            </div>
                          ))
                        )}

                        {session.settlement && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="font-semibold text-emerald-950">
                                Payment record{session.settlement.invoice_number ? ` · ${session.settlement.invoice_number}` : ""}
                              </h3>
                              <span className="text-xs text-emerald-900">
                                Settled {formatVisitDate(session.settlement.settled_at)}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                              <span>Subtotal <strong>{formatCurrency(session.settlement.subtotal_paise)}</strong></span>
                              <span>Discount <strong>{formatCurrency(session.settlement.discount_paise)}</strong></span>
                              <span>Tax <strong>{formatCurrency(session.settlement.tax_paise)}</strong></span>
                              <span>Total paid <strong>{formatCurrency(session.settlement.total_paid_paise)}</strong></span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {session.settlement.payments.map((payment, index) => (
                                <span key={`${payment.tender}-${payment.received_at}-${index}`} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium capitalize text-emerald-950">
                                  {payment.tender}: {formatCurrency(payment.amount_paise)}
                                  {payment.reference ? ` · ${payment.reference}` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#F0EBE2] px-4 py-3 sm:px-6">
              <span className="text-xs text-[#6F6961]">
                Page {data.page} of {data.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={isLoading || data.page <= 1}
                  onClick={() => void loadHistory(data.page - 1)}
                  className="rounded-lg border border-[#EAE3D5] p-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={isLoading || data.page >= data.totalPages}
                  onClick={() => void loadHistory(data.page + 1)}
                  className="rounded-lg border border-[#EAE3D5] p-2 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
