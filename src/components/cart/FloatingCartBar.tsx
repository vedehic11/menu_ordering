"use client";

import React from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/formatters";

interface FloatingCartBarProps {
  onOpenCheckout: () => void;
}

export function FloatingCartBar({ onOpenCheckout }: FloatingCartBarProps) {
  const { totalCount, totalPaise } = useCart();

  if (totalCount === 0) return null;

  return (
    // bottom-[72px] = sits just above the 72px bottom nav
    <aside
      aria-label="Cart summary"
      className="fixed bottom-[72px] left-0 right-0 z-40 px-4 sm:px-6 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        <button
          onClick={onOpenCheckout}
          type="button"
          className="w-full bg-[#171513] text-[#FDFBF7] p-3 sm:p-4 rounded-3xl shadow-[0_8px_32px_rgba(23,21,19,0.40)] border border-[#38332E] hover:border-[#C5A059] flex items-center justify-between gap-2 transition-all duration-300 active:scale-[0.98] cursor-pointer group"
        >
          {/* Left */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#3D3732] bg-[#262320] text-[#DFC894] sm:h-10 sm:w-10">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-[#C5A059] text-[#171513] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {totalCount}
              </span>
            </div>
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-[#A8A196] font-medium tracking-wide block uppercase">
                Cart ready
              </span>
              <span className="block truncate text-xs font-semibold text-white sm:text-sm">
                {totalCount} {totalCount === 1 ? "dish" : "dishes"} selected
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="text-right">
              <span className="hidden text-[10px] font-medium uppercase text-[#A8A196] sm:block">Table total</span>
              <span className="text-sm font-serif font-bold text-[#DFC894] sm:text-base">
                {formatCurrency(totalPaise)}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C5A059] text-[#171513] shadow-sm transition-all group-hover:scale-105 group-hover:bg-[#DFC894] sm:h-9 sm:w-9">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}
