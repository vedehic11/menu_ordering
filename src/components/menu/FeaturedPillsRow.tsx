"use client";

import React, { useState } from "react";
import { Plus, Minus, Sparkles } from "lucide-react";
import { MenuItem } from "@/types/database";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/formatters";

const STATION_IMAGES: Record<string, string> = {
  robata: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
  mains: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80",
  bar: "https://images.unsplash.com/photo-1550950158-d0d960dff51b?auto=format&fit=crop&w=600&q=80",
  pastry: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=600&q=80",
  default: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
};

function FeaturedPill({ item }: { item: MenuItem }) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.menuItem.id === item.id);
  const quantity = cartItem ? cartItem.quantity : 0;
  const [justAdded, setJustAdded] = useState(false);
  const imgSrc = item.image_url || STATION_IMAGES[item.station] || STATION_IMAGES.default;

  const handleAdd = () => {
    addItem(item);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1000);
  };

  return (
    <div className="shrink-0 w-44 rounded-2xl overflow-hidden border border-[#EAE3D5] bg-white shadow-sm hover:shadow-md hover:border-[#C5A059]/40 transition-all group">
      {/* Image */}
      <div className="relative h-28 overflow-hidden bg-[#F6F1E7]">
        <img
          src={imgSrc}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 rounded-full bg-[#C5A059]/90 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        {quantity > 0 && (
          <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-[#C5A059] text-[#171513] text-[10px] font-black flex items-center justify-center shadow">
            {quantity}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-xs font-bold text-[#171513] line-clamp-2 leading-snug mb-1 group-hover:text-[#987532] transition-colors font-serif">
          {item.name}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-bold text-[#987532]">{formatCurrency(item.price_paise)}</span>
          {quantity > 0 ? (
            <div className="flex items-center gap-1 bg-[#171513] rounded-full px-1 py-0.5">
              <button type="button" onClick={() => updateQuantity(item.id, quantity - 1)} className="w-4 h-4 flex items-center justify-center text-white cursor-pointer">
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="text-[9px] font-black text-[#DFC894] min-w-[10px] text-center">{quantity}</span>
              <button type="button" onClick={() => updateQuantity(item.id, quantity + 1)} className="w-4 h-4 flex items-center justify-center text-white cursor-pointer">
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                justAdded ? "bg-[#C5A059] text-[#171513]" : "bg-[#171513] text-white hover:bg-[#C5A059] hover:text-[#171513]"
              }`}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FeaturedPillsRowProps {
  items: MenuItem[];
}

export function FeaturedPillsRow({ items }: FeaturedPillsRowProps) {
  const featured = items.filter((item) => item.is_available && item.is_chef_special);

  if (featured.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">👨‍🍳</span>
          <div>
            <h2 className="font-serif text-lg font-bold text-[#171513] leading-tight">
              Chef&apos;s Specials
            </h2>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              Curated daily creations from our open theatre kitchen
            </p>
          </div>
        </div>
        <span className="text-[9px] px-2.5 py-1 rounded-full bg-[#C5A059]/15 text-[#987532] font-bold uppercase tracking-widest border border-[#C5A059]/30 shrink-0">
          ⭐ Handpicked
        </span>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {featured.map((item) => (
          <FeaturedPill key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
