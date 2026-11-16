"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  Bell,
  CheckCircle2,
  Droplets,
  Receipt,
  UtensilsCrossed,
  RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { playKitchenChime } from "@/lib/sound";
import { ServiceRequest } from "@/types/database";

export default function ServiceCallsDesk() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const prevPendingCount = useRef(0);

  const fetchRequests = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/service-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load service requests.");
      if (!Array.isArray(data.requests)) throw new Error("Service request data was not in the expected format.");

      const pending = data.requests.filter((r: ServiceRequest) => r.status === "pending");
      if (pending.length > prevPendingCount.current && soundEnabled) {
        playKitchenChime();
      }
      prevPendingCount.current = pending.length;
      setRequests(data.requests);
      setDataError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load service requests.";
      setDataError(message);
      console.error("Service fetch error:", fetchError);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [soundEnabled]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchRequests());
    const timer = setInterval(fetchRequests, 3500);
    return () => clearInterval(timer);
  }, [fetchRequests]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    setActionError(null);
    try {
      const res = await fetch("/api/service-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "resolved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to mark this request attended.");
      await fetchRequests();
    } catch (resolveError) {
      const message = resolveError instanceof Error ? resolveError.message : "Unable to mark this request attended.";
      setActionError(message);
      console.error("Failed to resolve request:", resolveError);
    } finally {
      setResolvingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === "pending") return r.status === "pending";
    if (filter === "resolved") return r.status === "resolved";
    return true;
  });

  const getRequestIcon = (type: string) => {
    switch (type) {
      case "water":
        return <Droplets className="w-5 h-5 text-sky-500" />;
      case "cutlery":
        return <UtensilsCrossed className="w-5 h-5 text-amber-500" />;
      case "bill":
        return <Receipt className="w-5 h-5 text-emerald-500" />;
      default:
        return <Bell className="w-5 h-5 text-[#987532]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
      <AdminNav
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        pendingRequestsCount={requests.filter((r) => r.status === "pending").length}
      />

      <div className="mx-auto min-w-0 max-w-5xl space-y-6 px-4 pt-20 pb-28 sm:px-6 md:py-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-[#EAE3D5] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#171513]">
                Guest Service Call Queue
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-mono font-bold">
                {requests.filter((r) => r.status === "pending").length} Pending
              </span>
            </div>
            <p className="text-xs text-[#6F6961] mt-0.5">
              Live table assistance • Water bottle refills • Cutlery requests • Cashier bill calls
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-white border border-[#D9D2C5] p-1 text-xs">
              {(["pending", "resolved", "all"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilter(mode)}
                  className={`px-3 py-1 rounded-lg capitalize font-semibold transition-all cursor-pointer ${
                    filter === mode
                      ? "bg-[#171513] text-[#FAF7F2] shadow-xs"
                      : "text-[#6F6961] hover:text-[#171513]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={() => void fetchRequests(true)}
              type="button"
              aria-label="Refresh service requests"
              title="Refresh service requests"
              disabled={isRefreshing}
              className="min-h-10 min-w-10 rounded-xl border border-[#D9D2C5] bg-white text-[#6F6961] hover:text-[#171513] disabled:opacity-50"
            >
              <RefreshCw className={`mx-auto w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {(dataError || actionError) && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{actionError || dataError}</span>
            {dataError && (
              <button type="button" onClick={() => void fetchRequests(true)} className="shrink-0 font-semibold underline">
                Retry
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-[#EAE3D5] bg-white px-5 py-10 text-center text-sm text-[#6F6961]">
            Loading service requests…
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-[#D9D2C5]">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h3 className="font-serif text-lg font-bold text-[#171513]">All Calls Attended!</h3>
            <p className="text-xs text-[#6F6961] max-w-sm mx-auto mt-1">
              No pending service requests in queue. Guests can summon assistance from their tabletop QR menu.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const isPending = req.status === "pending";
              return (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${
                    isPending
                      ? "bg-white border-[#C5A059] shadow-sm ring-1 ring-[#C5A059]/20"
                      : "bg-[#F5F2EB]/50 border-[#EAE3D5] opacity-75"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FDFBF7] border border-[#EAE3D5] flex items-center justify-center shrink-0">
                      {getRequestIcon(req.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-base text-[#171513]">
                          {req.table_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold bg-[#FAF7F2] border border-[#D9D2C5] text-[#987532]">
                          {req.type}
                        </span>
                      </div>
                      {req.note && (
                        <p className="text-xs text-[#171513] mt-0.5">
                          &quot;{req.note}&quot;
                        </p>
                      )}
                      <p className="text-[10px] text-[#A8A196] font-mono mt-1">
                        Called at {formatDate(req.created_at)}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isPending ? (
                      <button
                        type="button"
                        disabled={resolvingId !== null}
                        onClick={() => handleResolve(req.id)}
                        className="w-full sm:w-auto py-2 px-4 rounded-xl bg-[#171513] text-[#FAF7F2] text-xs font-semibold hover:bg-[#33302B] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:cursor-wait disabled:opacity-60"
                      >
                        {resolvingId === req.id ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Saving…</span></>
                        ) : (
                          <><CheckCircle2 className="w-3.5 h-3.5 text-[#DFC894]" /><span>Mark as Attended</span></>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-semibold font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
