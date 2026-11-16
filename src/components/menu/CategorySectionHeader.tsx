"use client";

import React from "react";
import { MenuCategory } from "@/types/database";

// Station hero images for category headers
const STATION_IMAGES: Record<string, string> = {
  robata: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=75",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=75",
  mains: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=75",
  bar: "https://images.unsplash.com/photo-1550950158-d0d960dff51b?auto=format&fit=crop&w=1200&q=75",
  pastry: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1200&q=75",
};

const STATION_EMOJI: Record<string, string> = {
  robata: "🔥",
  pizza: "🍕",
  mains: "🍽️",
  bar: "🍹",
  pastry: "🍮",
};

interface CategorySectionHeaderProps {
  category: MenuCategory;
}

export function CategorySectionHeader({ category }: CategorySectionHeaderProps) {
  const station = category.station || "default";
  const img = STATION_IMAGES[station];
  const emoji = STATION_EMOJI[station] || "🍴";

  return (
    <div className="relative rounded-2xl overflow-hidden mb-5" style={{ height: "100px" }}>
      {/* Background image */}
      {img && (
        <img
          src={img}
          alt={category.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#171513]/90 via-[#171513]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#171513]/60 to-transparent" />

      {/* Text content */}
      <div className="absolute inset-0 flex items-center px-5">
        <div>
          <div className="text-xl mb-0.5">{emoji}</div>
          <h2 className="font-serif text-xl font-bold text-white leading-tight">
            {category.name}
          </h2>
          {category.description && (
            <p className="text-xs text-[#DFC894]/80 mt-0.5 line-clamp-1 max-w-[220px]">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {/* Gold left border accent */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#C5A059] via-[#DFC894] to-[#C5A059]" />
    </div>
  );
}
