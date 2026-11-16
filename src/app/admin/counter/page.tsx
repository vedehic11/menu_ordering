"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  Banknote,
  Receipt,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Smartphone,
  Coins,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { calculateRestaurantTax } from "@/lib/tax";
import { playKitchenChime } from "@/lib/sound";
import { DiningTable, TableSession, StoredOrder, PaymentTender, ServiceRequest } from "@/types/database";

export default function CounterBillingDesk() {
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [staffRole, setStaffRole] = useState("");

  // Selected Table for Detail / Settlement
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [printFormat, setPrintFormat] = useState<"receipt" | "a4">("receipt");

  // Settlement Modal State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [singleTender, setSingleTender] = useState<PaymentTender>("upi");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitUpi, setSplitUpi] = useState<string>("");
  const [splitCard, setSplitCard] = useState<string>("");
  const [discountRupees, setDiscountRupees] = useState<string>("0");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // Print Invoice State
  const [invoiceSession, setInvoiceSession] = useState<{
    session: TableSession;
    orders: StoredOrder[];
    tableNumber: string | number;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  } | null>(null);

  const prevBillRequestsCount = useRef(0);

  useEffect(() => {
    void Promise.resolve().then(() => setStaffRole(localStorage.getItem("staff_role") || ""));
  }, []);

  useEffect(() => {
    if (!selectedTableId) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTableId("");
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTableId]);

  useEffect(() => {
    if (!invoiceSession) return;

    document.body.classList.add("printing-invoice");
    document.body.classList.toggle("printing-invoice-a4", printFormat === "a4");
    return () => {
      document.body.classList.remove("printing-invoice", "printing-invoice-a4");
    };
  }, [invoiceSession, printFormat]);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [sessRes, ordersRes, reqsRes, tablesRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/orders"),
        fetch("/api/service-requests"),
        fetch("/api/tables"),
      ]);

      const [sessData, ordersData, reqsData, tablesData] = await Promise.all(
        [sessRes, ordersRes, reqsRes, tablesRes].map(async (response) => {
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error || "Unable to load counter data.");
          }
          return body;
        }),
      );

      if (Array.isArray(sessData.sessions)) setSessions(sessData.sessions);
      if (Array.isArray(ordersData.orders)) setOrders(ordersData.orders);
      if (Array.isArray(tablesData.tables)) {
        setTables(tablesData.tables);
        setSelectedTableId((current) =>
          tablesData.tables.some((table: DiningTable) => table.id === current) ? current : "",
        );
      }
      if (reqsData.requests) {
        setServiceRequests(reqsData.requests);
        const billCalls = reqsData.requests.filter((r: ServiceRequest) => r.type === "bill" && r.status === "pending");
        if (billCalls.length > prevBillRequestsCount.current && soundEnabled) {
          playKitchenChime();
        }
        prevBillRequestsCount.current = billCalls.length;
      }
      setDataError(null);
    } catch (err) {
      console.error("Counter fetch error:", err);
      setDataError(err instanceof Error ? err.message : "Unable to load counter data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [soundEnabled]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchData());
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const pendingServiceCount = serviceRequests.filter((r) => r.status === "pending").length;
  const billRequestsCount = serviceRequests.filter((r) => r.type === "bill" && r.status === "pending").length;

  // Active session for each physical table
  const tableDataMap = tables.map((table) => {
    const activeSession = sessions.find(
      (s) => s.table_id === table.id && ["open", "bill_requested", "closing"].includes(s.status)
    );
    const tableOrders = activeSession
      ? orders.filter((o) => o.session_id === activeSession.id)
      : [];
    const totalPaise = tableOrders.reduce((sum, o) => sum + o.subtotal_paise, 0);
    const isBillRequested = activeSession?.status === "bill_requested" ||
      serviceRequests.some((r) => r.table_id === table.id && r.type === "bill" && r.status === "pending");

    return {
      table,
      session: activeSession,
      orders: tableOrders,
      totalPaise,
      isOccupied: Boolean(activeSession && tableOrders.length > 0),
      isBillRequested,
      orderCount: tableOrders.length,
    };
  });

  const selectedData = tableDataMap.find((td) => td.table.id === selectedTableId);
  if (tableDataMap.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
        <AdminNav soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled(!soundEnabled)} />
        <main className="mx-auto max-w-3xl space-y-3 px-4 pb-28 pt-20 md:py-10">
          <h1 className="font-serif text-2xl font-bold">Admin Desk</h1>
          <p className="text-sm text-[#6F6961]">
            {isLoading ? "Loading table data…" : dataError || "No active dining tables are configured."}
          </p>
        </main>
      </div>
    );
  }

  // Financial calculations for active selected session
  const subtotalPaise = selectedData?.totalPaise ?? 0;
  const discountPaise = Math.round(Number(discountRupees || 0) * 100);
  const netBeforeTaxPaise = Math.max(0, subtotalPaise - discountPaise);
  // GST 5% (2.5% CGST + 2.5% SGST)
  const { totalPaise: gstPaise } = calculateRestaurantTax(netBeforeTaxPaise);
  const netPayablePaise = netBeforeTaxPaise + gstPaise;

  // Split calculations
  const cashAmountPaise = Math.round(Number(splitCash || 0) * 100);
  const upiAmountPaise = Math.round(Number(splitUpi || 0) * 100);
  const cardAmountPaise = Math.round(Number(splitCard || 0) * 100);
  const totalPaidInSplitPaise = cashAmountPaise + upiAmountPaise + cardAmountPaise;
  const splitBalanceRemainingPaise = netPayablePaise - totalPaidInSplitPaise;

  const handleOpenSettlement = () => {
    if (!selectedData?.session) return;
    setSettlementError(null);
    setDiscountRupees("0");
    setSplitMode(false);
    setSingleTender("upi");
    setSplitCash("");
    setSplitUpi("");
    setSplitCard("");
    setIsSettlementModalOpen(true);
  };

  const handleConfirmSettlement = async () => {
    if (!selectedData?.session) return;
    setSettlementError(null);
    setIsSubmittingSettlement(true);

    try {
      const payments: { tender: PaymentTender; amount_paise: number }[] = [];

      if (splitMode) {
        if (splitBalanceRemainingPaise !== 0) {
          throw new Error(`Split total must equal ₹${(netPayablePaise / 100).toFixed(2)}. Current difference: ₹${(splitBalanceRemainingPaise / 100).toFixed(2)}`);
        }
        if (cashAmountPaise > 0) payments.push({ tender: "cash", amount_paise: cashAmountPaise });
        if (upiAmountPaise > 0) payments.push({ tender: "upi", amount_paise: upiAmountPaise });
        if (cardAmountPaise > 0) payments.push({ tender: "card", amount_paise: cardAmountPaise });
      } else {
        payments.push({ tender: singleTender, amount_paise: netPayablePaise });
      }

      const res = await fetch(`/api/admin/sessions/${selectedData.session.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments,
          discountPaise,
          taxPaise: gstPaise,
          cashierId: "cashier-andheri-1",
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to settle table.");
      }

      // Settle pending service bill requests for this table
      const billReq = serviceRequests.find((r) => r.table_id === selectedData.table.id && r.type === "bill" && r.status === "pending");
      if (billReq) {
        await fetch("/api/service-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: billReq.id, status: "resolved" }),
        });
      }

      setIsSettlementModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      setSettlementError(err instanceof Error ? err.message : "Failed to process settlement");
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
      <AdminNav
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        pendingRequestsCount={pendingServiceCount}
        billRequestsCount={billRequestsCount}
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-20 pb-28 sm:px-6 md:py-6 lg:px-8">
        {dataError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span>{dataError}</span>
            <button type="button" onClick={() => void fetchData(true)} disabled={isRefreshing} className="shrink-0 font-semibold underline disabled:opacity-50">
              Retry
            </button>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D5]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#171513]">
                Admin Desk
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold capitalize">
                {staffRole ? `${staffRole} session` : "Staff session"}
              </span>
            </div>
            <p className="text-xs text-[#6F6961] mt-0.5">
              Manage table orders, print bills and record payments
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(staffRole === "manager" || staffRole === "owner") && (
              <Link
                href="/admin/inventory"
                className="inline-flex items-center px-3 py-1.5 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2]"
              >
                Menu & specials
              </Link>
            )}
            <Link
              href="/admin/tables"
              className="inline-flex items-center px-3 py-1.5 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2]"
            >
              Table QR codes
            </Link>
            <Link
              href="/admin/service"
              className="inline-flex items-center px-3 py-1.5 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2]"
            >
              Service requests
            </Link>
            <button
              onClick={() => void fetchData(true)}
              type="button"
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#987532] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Syncing…" : "Sync tables"}</span>
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#A8A196] font-bold">
                Dining Tables ({tableDataMap.length})
              </h2>
              <span className="text-xs text-[#6F6961] font-mono">
                {tableDataMap.filter((t) => t.isOccupied).length} Occupied
              </span>
            </div>

            <div className="space-y-2.5">
              {tableDataMap.map((td) => {
                const isSelected = td.table.id === selectedTableId;
                return (
                  <button
                    key={td.table.id}
                    type="button"
                    onClick={() => setSelectedTableId(td.table.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? "bg-white border-[#C5A059] shadow-md ring-2 ring-[#C5A059]/20"
                        : "bg-white/80 border-[#EAE3D5] hover:border-[#C5A059]/60 hover:bg-white"
                    }`}
                  >
                    {/* Highlight tables where a guest has asked for the bill. */}
                    {td.isBillRequested && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
                    )}

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-base text-[#171513]">
                            {td.table.table_number}
                          </span>
                          {td.isBillRequested && (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider animate-pulse border border-red-200">
                              Guest asked for the bill
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#6F6961] mt-0.5 font-mono">
                          {td.isOccupied
                            ? `${td.orderCount} ${td.orderCount === 1 ? "order" : "orders"}${td.session?.opened_at ? ` • Open since ${formatDate(td.session.opened_at)}` : ""}`
                            : "Table Vacant • Ready for guests"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-serif text-lg font-bold text-[#171513] block">
                          {td.isOccupied ? formatCurrency(td.totalPaise) : "—"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            td.isOccupied
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {td.isOccupied ? "Dining" : "Vacant"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedData && (
          <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedTableId("");
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="selected-table-heading"
              className="max-h-[92vh] w-full max-w-3xl space-y-6 overflow-y-auto rounded-3xl border border-[#EAE3D5] bg-white p-4 shadow-2xl sm:p-6"
            >
              {/* Table Tab Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#EAE3D5] gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="selected-table-heading" className="font-serif text-xl font-bold text-[#171513]">
                      {selectedData.table.table_number}
                    </h2>
                    {selectedData.isBillRequested && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
                        Guest asked for the bill
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Close table details"
                      onClick={() => setSelectedTableId("")}
                      className="ml-auto rounded-xl p-2 text-[#6F6961] hover:bg-[#FAF7F2] hover:text-[#171513]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#6F6961] font-mono mt-0.5">
                    {selectedData.session
                      ? `Open since ${formatDate(selectedData.session.opened_at)}`
                      : "No active visit on this table"}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-[#A8A196] block">Unsettled Balance</span>
                  <span className="font-serif text-3xl font-black text-[#987532]">
                    {formatCurrency(selectedData.totalPaise)}
                  </span>
                </div>
              </div>

              {/* Orders */}
              {selectedData.orders.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-[#EAE3D5] rounded-2xl bg-[#FDFBF7]">
                  <Receipt className="w-8 h-8 text-[#A8A196] mx-auto mb-2 opacity-50" />
                  <p className="font-serif font-bold text-base text-[#171513]">No open orders</p>
                  <p className="text-xs text-[#6F6961] max-w-xs mx-auto mt-1">
                    There are no current orders for this table.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#A8A196] font-bold">
                    Orders
                  </h3>

                  <div className="space-y-3">
                    {selectedData.orders.map((ord) => {
                      const items = ord.items || [];
                      return (
                        <div
                          key={ord.id}
                          className="p-4 rounded-2xl border border-[#EAE3D5] bg-[#FDFBF7] space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#171513]">
                                Order #{ord.order_number}
                              </span>
                              <span className="text-[10px] text-[#A8A196] font-mono">
                                {formatDate(ord.created_at)}
                              </span>
                            </div>
                            <span className="font-bold font-mono text-[#987532]">
                              {formatCurrency(ord.total_paise || ord.subtotal_paise)}
                            </span>
                          </div>

                          {/* Line items */}
                          <div className="divide-y divide-[#EAE3D5]/60 text-xs">
                            {items.map((item, itemIdx) => (
                              <div key={itemIdx} className="py-1.5 flex justify-between items-center text-[#171513]">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded font-mono text-[11px]">
                                    {item.quantity}×
                                  </span>
                                  <span>{item.item_name}</span>
                                  {item.station && (
                                    <span className="text-[9px] uppercase font-mono px-1.5 rounded bg-[#EAE3D5] text-[#6F6961]">
                                      {item.station}
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[#6F6961]">
                                  {formatCurrency(item.line_total_paise || item.unit_price_paise * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bill Action Bar */}
                  <div className="pt-4 border-t border-[#EAE3D5] flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleOpenSettlement}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#171513] text-[#FAF7F2] font-semibold text-xs hover:bg-[#33302B] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Banknote className="w-4 h-4 text-[#DFC894]" />
                      <span>Settle & Close Table Bill &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedData.session) {
                          setInvoiceSession({
                            session: selectedData.session,
                            orders: selectedData.orders,
                            tableNumber: selectedData.table.table_number,
                            subtotal: selectedData.totalPaise,
                            discount: 0,
                            tax: Math.round(selectedData.totalPaise * 0.05),
                            total: Math.round(selectedData.totalPaise * 1.05),
                          });
                        }
                      }}
                      className="py-3 px-4 rounded-xl border border-[#D9D2C5] bg-white text-[#171513] font-semibold text-xs hover:bg-[#FAF7F2] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-[#987532]" />
                      <span>Print Bill</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* MODAL: Settle & Close Table */}
      {isSettlementModalOpen && selectedData?.session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#EAE3D5] p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE3D5]">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#171513]">
                  Counter Bill Settlement
                </h3>
                <p className="text-xs text-[#6F6961]">
                  {selectedData.table.table_number} • Session #{selectedData.session.session_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="p-1 rounded-lg text-[#6F6961] hover:text-[#171513] hover:bg-[#FAF7F2]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner if any */}
            {settlementError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{settlementError}</span>
              </div>
            )}

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#EAE3D5] space-y-2 text-xs">
              <div className="flex justify-between text-[#6F6961]">
                <span>Food & Beverage Subtotal</span>
                <span className="font-mono font-semibold text-[#171513]">
                  {formatCurrency(subtotalPaise)}
                </span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between text-[#6F6961]">
                <span>Discount / Concession (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={discountRupees}
                  onChange={(e) => setDiscountRupees(e.target.value)}
                  className="w-24 px-2 py-1 text-right text-xs font-mono rounded-lg border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              {/* Tax is calculated consistently by the server and counter. */}
              <div className="flex items-center justify-between text-[#6F6961] pt-1 border-t border-[#EAE3D5]/60">
                <span>Restaurant GST 5% (2.5% CGST + 2.5% SGST)</span>
                <span className="font-mono text-[#171513]">
                  {formatCurrency(gstPaise)}
                </span>
              </div>

              {/* Net Payable Highlight */}
              <div className="pt-2 border-t border-[#EAE3D5] flex justify-between items-baseline">
                <span className="font-serif font-bold text-sm text-[#171513]">Total Bill Amount</span>
                <span className="font-serif text-2xl font-black text-[#987532]">
                  {formatCurrency(netPayablePaise)}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector: Single Tender vs Split */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase font-bold text-[#A8A196]">
                  Payment Method
                </span>
                <label className="flex items-center gap-1.5 text-xs text-[#6F6961] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitMode}
                    onChange={(e) => setSplitMode(e.target.checked)}
                    className="accent-[#171513] rounded"
                  />
                  <span>Split Payment Across Multiple Tenders</span>
                </label>
              </div>

              {!splitMode ? (
                /* Single Tender Buttons */
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "upi", label: "UPI / QR", icon: Smartphone },
                    { id: "card", label: "Credit/Debit", icon: CreditCard },
                    { id: "cash", label: "Cash", icon: Coins },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = singleTender === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSingleTender(t.id as PaymentTender)}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#171513] text-[#DFC894] border-[#171513] shadow-sm"
                            : "bg-white text-[#171513] border-[#EAE3D5] hover:border-[#C5A059]"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Split Tender Mode */
                <div className="p-4 rounded-2xl border border-[#EAE3D5] bg-[#FDFBF7] space-y-3 text-xs">
                  <p className="text-[11px] text-[#6F6961]">
                    Enter the amount collected through each method (must sum to exactly {formatCurrency(netPayablePaise)}):
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-[#987532]" />
                        <span>Cash Amount (₹)</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-32 px-2.5 py-1 text-right font-mono rounded-lg border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-[#987532]" />
                        <span>UPI / QR Amount (₹)</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={splitUpi}
                        onChange={(e) => setSplitUpi(e.target.value)}
                        className="w-32 px-2.5 py-1 text-right font-mono rounded-lg border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#987532]" />
                        <span>Card POS Amount (₹)</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={splitCard}
                        onChange={(e) => setSplitCard(e.target.value)}
                        className="w-32 px-2.5 py-1 text-right font-mono rounded-lg border border-[#D9D2C5] bg-white focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#EAE3D5] flex justify-between font-mono text-xs font-semibold">
                    <span>Difference Remaining:</span>
                    <span
                      className={
                        splitBalanceRemainingPaise === 0
                          ? "text-emerald-700 font-bold"
                          : "text-red-600 font-bold"
                      }
                    >
                      {formatCurrency(splitBalanceRemainingPaise)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm & Close Button */}
            <div className="pt-3 border-t border-[#EAE3D5] flex gap-3">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSettlement || (splitMode && splitBalanceRemainingPaise !== 0)}
                onClick={handleConfirmSettlement}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#171513] text-[#FAF7F2] text-xs font-semibold hover:bg-[#33302B] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {isSubmittingSettlement ? (
                  <span>Recording Settlement...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#DFC894]" />
                    <span>Confirm Payment & Close Table</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable customer bill */}
      {invoiceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="invoice-print bg-white rounded-3xl border border-[#EAE3D5] p-6 max-w-sm w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Thermal Print Receipt Simulation */}
            <div className="font-mono text-xs space-y-3 bg-[#FDFBF7] p-5 rounded-2xl border border-dashed border-[#D9D2C5]">
              <div className="text-center space-y-1">
                <h4 className="font-serif font-black text-base text-[#171513]">My, Oh My</h4>
                <p className="text-[10px] text-[#6F6961]">Customer bill</p>
              </div>

              <div className="border-t border-b border-[#EAE3D5] py-2 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Table:</span>
                  <strong className="text-[#171513]">{invoiceSession.tableNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Session:</span>
                  <span>#{invoiceSession.session.session_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatDate(new Date().toISOString())}</span>
                </div>
              </div>

              {/* Items breakdown */}
              <div className="space-y-1 text-[11px]">
                {invoiceSession.orders.flatMap((o) => o.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-2">
                      {item.quantity}× {item.item_name}
                    </span>
                    <span className="font-semibold shrink-0">
                      {formatCurrency(item.line_total_paise || item.unit_price_paise * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-[#D9D2C5] pt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoiceSession.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST 2.5%:</span>
                  <span>{formatCurrency(Math.round(invoiceSession.tax / 2))}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST 2.5%:</span>
                  <span>{formatCurrency(Math.round(invoiceSession.tax / 2))}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-[#171513] pt-1 border-t border-[#171513]">
                  <span>NET TOTAL:</span>
                  <span>{formatCurrency(invoiceSession.total)}</span>
                </div>
              </div>

              <div className="text-center pt-3 text-[10px] text-[#6F6961]">
                <p>Thank you for dining with us!</p>
                <p className="text-[9px] text-[#A8A196]">Pay at Counter • Cash / UPI / Card</p>
              </div>
            </div>

            <div className="invoice-print-controls space-y-3">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Bill print format">
                <button
                  type="button"
                  aria-pressed={printFormat === "receipt"}
                  onClick={() => setPrintFormat("receipt")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    printFormat === "receipt"
                      ? "border-[#987532] bg-[#F6F1E7] text-[#171513]"
                      : "border-[#D9D2C5] bg-white text-[#6F6961]"
                  }`}
                >
                  Receipt printer (80 mm)
                </button>
                <button
                  type="button"
                  aria-pressed={printFormat === "a4"}
                  onClick={() => setPrintFormat("a4")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    printFormat === "a4"
                      ? "border-[#987532] bg-[#F6F1E7] text-[#171513]"
                      : "border-[#D9D2C5] bg-white text-[#6F6961]"
                  }`}
                >
                  A4 printer
                </button>
              </div>
              <p className="text-center text-[11px] leading-relaxed text-[#6F6961]">
                Print opens your browser&apos;s print dialog. Select the connected printer and matching paper size there.
              </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInvoiceSession(null)}
                className="py-2 px-3 flex-1 rounded-xl border border-[#D9D2C5] text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 px-4 flex-1 rounded-xl bg-[#171513] text-[#FAF7F2] text-xs font-semibold hover:bg-[#33302B] flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Open print dialog</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
