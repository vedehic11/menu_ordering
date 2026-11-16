"use client";

import React, { useRef, useEffect } from "react";
import { MenuCategory } from "@/types/database";

// Category emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  starters: "🥗",
  appetisers: "🥗",
  appetizers: "🥗",
  salads: "🥬",
  soups: "🍲",
  breads: "🍞",
  robata: "🔥",
  grill: "🔥",
  grills: "🔥",
  pizza: "🍕",
  pizzas: "🍕",
  pasta: "🍝",
  mains: "🍽️",
  "main course": "🍽️",
  desserts: "🍮",
  dessert: "🍮",
  sweets: "🍰",
  drinks: "🍹",
  beverages: "🍹",
  cocktails: "🍸",
  mocktails: "🍋",
  bar: "🍸",
  wine: "🍷",
  beer: "🍺",
  spirits: "🥃",
  coffee: "☕",
  tea: "🫖",
  juices: "🧃",
  "non-veg": "🍖",
  vegan: "🌱",
  specials: "⭐",
  chef: "👨‍🍳",
  "chef's": "👨‍🍳",
};

function getCategoryEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return "🍴";
}

interface CategoryNavProps {
  categories: MenuCategory[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
}

export function CategoryNav({ categories, activeCategoryId, onSelectCategory }: CategoryNavProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Scroll active pill into view on category change
  useEffect(() => {
    if (activeRef.current && navRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeCategoryId]);

  return (
    <nav className="sticky top-0 z-30 bg-[#FDFBF7]/95 backdrop-blur-xl border-b border-[#EAE3D5] shadow-sm">
      <div
        ref={navRef}
        className="flex items-center gap-2 overflow-x-auto py-3 px-4 sm:px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* ALL pill */}
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          ref={activeCategoryId === "all" ? activeRef : undefined}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 ${
            activeCategoryId === "all"
              ? "bg-[#171513] text-[#FDFBF7] shadow-md"
              : "bg-white text-[#6F6961] border border-[#EAE3D5] hover:border-[#C5A059] hover:text-[#171513]"
          }`}
        >
          <span>🍴</span>
          <span>All Courses</span>
        </button>

        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          const emoji = getCategoryEmoji(cat.name);
          return (
            <button
              key={cat.id}
              type="button"
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#171513] text-[#FDFBF7] shadow-md"
                  : "bg-white text-[#6F6961] border border-[#EAE3D5] hover:border-[#C5A059] hover:text-[#171513]"
              }`}
            >
              <span>{emoji}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
