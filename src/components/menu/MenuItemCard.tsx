"use client";

import React, { useState } from "react";
import { Plus, Minus, Sparkles, Flame } from "lucide-react";
import { MenuItem } from "@/types/database";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/formatters";

// Per-item placeholder images based on station
const STATION_PLACEHOLDERS: Record<string, string> = {
  robata: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
  mains: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
  bar: "https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=800&q=80",
  pastry: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=800&q=80",
  default: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
};

interface MenuItemCardProps {
  item: MenuItem;
}

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.menuItem.id === item.id);
  const quantity = cartItem ? cartItem.quantity : 0;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const isSpicy = item.name.toLowerCase().includes("chili") || item.name.toLowerCase().includes("jalapeño") || item.name.toLowerCase().includes("guntur");
  const imgSrc = item.image_url || STATION_PLACEHOLDERS[item.station] || STATION_PLACEHOLDERS.default;

  const handleAdd = () => {
    addItem(item);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const nutrition = [
    item.calories !== null && item.calories !== undefined ? `${item.calories} kcal` : null,
    item.protein_grams !== null && item.protein_grams !== undefined ? `P ${item.protein_grams}g` : null,
    item.carbs_grams !== null && item.carbs_grams !== undefined ? `C ${item.carbs_grams}g` : null,
    item.fat_grams !== null && item.fat_grams !== undefined ? `F ${item.fat_grams}g` : null,
  ].filter(Boolean);

  return (
    <article
      className={`group relative flex items-center gap-3 rounded-2xl border bg-white p-3 transition-all duration-200 sm:gap-4 sm:p-4 ${
        !item.is_available
          ? "border-[#EAE3D5] opacity-70"
          : quantity > 0
          ? "border-[#C5A059] shadow-[0_4px_18px_rgba(197,160,89,0.14)]"
          : "border-[#EAE3D5] shadow-sm hover:border-[#C5A059]/50"
      }`}
    >
      <div className="min-w-0 flex-1 self-stretch">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${
            item.is_vegetarian
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            <span className={`flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border ${
              item.is_vegetarian ? "border-green-600" : "border-red-600"
            }`}>
              <span className={`h-1 w-1 rounded-full ${item.is_vegetarian ? "bg-green-600" : "bg-red-600"}`} />
            </span>
            {item.is_vegetarian ? "VEG" : "NON-VEG"}
          </span>
          {isSpicy && (
            <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-800">
              <Flame className="h-2.5 w-2.5" /> SPICY
            </span>
          )}
          {item.is_chef_special && item.is_available && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F6F1E7] px-1.5 py-0.5 text-[9px] font-bold text-[#987532]">
              <Sparkles className="h-2.5 w-2.5" /> CHEF&apos;S SPECIAL
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug text-[#171513] transition-colors group-hover:text-[#987532] sm:text-base">
          {item.name}
        </h3>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#78716C] sm:text-xs">
            {item.description}
          </p>
        )}

        {nutrition.length > 0 && (
          <p className="mt-1.5 text-[10px] font-medium text-[#78716C] sm:text-[11px]" aria-label={`Nutrition: ${nutrition.join(", ")}`}>
            {nutrition.join(" · ")}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#F5F2EB] pt-2.5">
          <span className="text-sm font-bold tracking-tight text-[#171513] sm:text-base">
            {formatCurrency(item.price_paise)}
          </span>

          {item.is_available ? (
            quantity > 0 ? (
              <div className="flex items-center gap-1 rounded-xl border border-[#2B2724] bg-[#171513] px-1 py-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-[#2B2724] active:scale-90"
                  aria-label="Remove one"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-6 px-1 text-center text-sm font-black text-[#DFC894]">{quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-[#2B2724] active:scale-90"
                  aria-label="Add one more"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className={`inline-flex min-h-9 items-center gap-1 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                  justAdded
                    ? "border-[#C5A059] bg-[#C5A059] text-[#171513]"
                    : "border-[#D6C7AD] bg-[#FDFBF7] text-[#171513] hover:border-[#171513] hover:bg-[#171513] hover:text-[#FDFBF7]"
                }`}
              >
                {justAdded ? <span>✓ Added</span> : <><Plus className="h-3.5 w-3.5 text-[#C5A059]" /> Add</>}
              </button>
            )
          ) : (
            <span className="text-[11px] italic text-[#A8A196]">Sold out</span>
          )}
        </div>
      </div>

      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#F6F1E7] sm:h-28 sm:w-28">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#F0EBE0] via-[#FAF7F2] to-[#F0EBE0] animate-pulse" />
        )}
        <img
          src={imgSrc}
          alt={item.name}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {!item.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#171513]/50">
            <span className="rounded-full bg-[#171513]/90 px-2 py-1 text-[9px] font-bold text-white">
              SOLD OUT
            </span>
          </div>
        )}
        {quantity > 0 && (
          <div className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-white bg-[#C5A059] px-1 text-xs font-black text-[#171513] shadow">
            {quantity}
          </div>
        )}
      </div>
    </article>
  );
}
