"use client";

import React, { useState, useEffect } from "react";
import { UtensilsCrossed, Receipt, Bell, Banknote, ChevronRight, X, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface CustomerBottomNavProps {
  token: string;
  tableNumber: string;
  runningTotal: number;        // paise
  roundCount: number;
  billRequested: boolean;
  isRequestingBill: boolean;
  onViewOrders: () => void;
  onCallStaff: () => void;
  onRequestBill: () => void;
  onOpenMenu: () => void;
  activeTab: "menu" | "orders" | "bill";
}

export function CustomerBottomNav({
  tableNumber,
  runningTotal,
  roundCount,
  billRequested,
  isRequestingBill,
  onViewOrders,
  onCallStaff,
  onRequestBill,
  onOpenMenu,
  activeTab,
}: CustomerBottomNavProps) {
  const tabs = [
    {
      id: "menu",
      label: "Menu",
      icon: UtensilsCrossed,
      onClick: onOpenMenu,
      badge: null,
    },
    {
      id: "orders",
      label: "My Tab",
      icon: Receipt,
      onClick: onViewOrders,
      badge: roundCount > 0 ? String(roundCount) : null,
    },
    {
      id: "staff",
      label: "Call Staff",
      icon: Bell,
      onClick: onCallStaff,
      badge: null,
      accent: true,
    },
    {
      id: "bill",
      label: billRequested ? "Bill Sent ✓" : "Get Bill",
      icon: Banknote,
      onClick: onRequestBill,
      badge: null,
      gold: true,
    },
  ] as const;

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#FDFBF7]/96 backdrop-blur-2xl border-t border-[#EAE3D5] shadow-[0_-8px_32px_rgba(23,21,19,0.10)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Running total banner */}
      {runningTotal > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-[#171513] px-3 py-1.5 text-xs text-[#FDFBF7] sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />
            <span className="text-[#A8A196]">Running tab</span>
            <span className="font-bold text-[#DFC894]">{formatCurrency(runningTotal)}</span>
            <span className="text-[#6F6961]">· {roundCount} {roundCount === 1 ? "order" : "orders"}</span>
          </div>
          {billRequested && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Bill at Counter
            </span>
          )}
        </div>
      )}

      {/* Tab Row */}
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isGold = "gold" in tab && tab.gold;
          const isAccent = "accent" in tab && tab.accent;
          const isDisabledBill = tab.id === "bill" && billRequested;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              disabled={isDisabledBill && isRequestingBill}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-center transition-all cursor-pointer ${
                isGold
                  ? billRequested
                    ? "text-emerald-600"
                    : "text-[#987532]"
                  : isAccent
                  ? "text-[#B45309]"
                  : isActive
                  ? "text-[#171513]"
                  : "text-[#A8A196]"
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#C5A059]" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 ${
                    isGold && !billRequested ? "text-[#C5A059]" : ""
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-[#C5A059] text-[#171513] text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] font-semibold leading-none ${
                isGold && !billRequested ? "text-[#987532]" : ""
              }`}>
                {isRequestingBill && tab.id === "bill" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  tab.label
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
