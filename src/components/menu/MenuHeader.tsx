"use client";

import React, { useState, useEffect, useRef } from "react";
import { Restaurant, DiningTable, CarouselSlide } from "@/types/database";
import { Flame, MapPin, Search, Leaf, ChevronLeft, ChevronRight } from "lucide-react";

// Hero carousel slides — cinematic food photography
const HERO_SLIDES: CarouselSlide[] = [
  {
    id: "default-1",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85",
    title: "Live Robata Grill",
    sub: "Charcoal-fired, table-side theatre",
  },
  {
    id: "default-2",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85",
    title: "Wood-Fired Sourdough",
    sub: "450°C craft-fire, 48-hour ferment",
  },
  {
    id: "default-3",
    image: "https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=1200&q=85",
    title: "Craft Botanical Bar",
    sub: "Cold-pressed elixirs & botanical tonics",
  },
  {
    id: "default-4",
    image: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1200&q=85",
    title: "Pastry Studio",
    sub: "French technique · Belgian chocolate",
  },
  {
    id: "default-5",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85",
    title: "Chef's Specials",
    sub: "Open theatre, slow braises & mains",
  },
];

interface MenuHeroProps {
  restaurant: Restaurant;
  table: DiningTable;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  vegOnly: boolean;
  onVegOnlyToggle: () => void;
  carouselSlides?: CarouselSlide[];
}

export function MenuHeader({
  restaurant,
  table,
  searchQuery,
  onSearchChange,
  vegOnly,
  onVegOnlyToggle,
  carouselSlides,
}: MenuHeroProps) {
  const slides = (carouselSlides && carouselSlides.length > 0) ? carouselSlides : HERO_SLIDES;
  const [slide, setSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (idx: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlide(idx);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const next = () => goTo((slide + 1) % slides.length);
  const prev = () => goTo((slide - 1 + slides.length) % slides.length);

  // Auto-advance every 4s
  useEffect(() => {
    autoRef.current = setInterval(next, 4000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [slide, slides.length]);

  const resetAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(next, 4000);
  };

  return (
    <header className="relative">
      {/* ═══ HERO CAROUSEL ═══ */}
      <div className="relative h-[52vw] min-h-[200px] max-h-[380px] overflow-hidden bg-[#171513]">
        {/* Slides */}
        {slides.map((s, i) => (
          <div
            key={s.id || i}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === slide ? 1 : 0, zIndex: i === slide ? 1 : 0 }}
          >
            <img
              src={s.image}
              alt={s.title}
              className="w-full h-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
            {/* Cinematic vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0B09]/90 via-[#0D0B09]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0D0B09]/40 via-transparent to-transparent" />

            {/* Slide caption */}
            <div
              className="absolute bottom-0 left-0 right-0 px-5 pb-5 transition-all duration-500"
              style={{ transform: i === slide ? "translateY(0)" : "translateY(8px)", opacity: i === slide ? 1 : 0 }}
            >
              <div className="text-[10px] tracking-[3px] uppercase text-[#C5A059] font-bold mb-1">{s.sub}</div>
              <h2 className="font-serif text-xl font-bold text-white leading-tight">{s.title}</h2>
            </div>
          </div>
        ))}

        {/* Carousel controls */}
        <button
          type="button"
          onClick={() => { prev(); resetAuto(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { next(); resetAuto(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-3 right-4 z-10 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { goTo(i); resetAuto(); }}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                i === slide ? "w-4 h-1.5 bg-[#C5A059]" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>

        {/* Top gold filament */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent z-10" />
      </div>

      {/* ═══ IDENTITY STRIP ═══ */}
      <div className="relative bg-[#FDFBF7] border-b border-[#EAE3D5]">
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #C5A059 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          {/* Table capsule — floating up from hero */}
          <div className="flex items-center justify-between pt-4 pb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171513] text-[#FDFBF7] text-xs font-semibold shadow-lg border border-[#2B2724]">
              <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
              <span>{table.table_number.toUpperCase()}</span>
              <span className="text-[#6F6961]">·</span>
              <span className="text-[#DFC894] text-[10px] tracking-widest uppercase font-bold">Dine-In</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-[#EAE3D5] text-[#6F6961] bg-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>Kitchen Open</span>
            </div>
          </div>

          {/* Brand */}
          <div className="pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className="w-3 h-3 text-[#C5A059]" />
              <span className="text-[10px] tracking-[3px] uppercase font-bold text-[#987532]">
                Wood-Fired · Craft Bar · Open Theatre
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#171513] tracking-tight leading-none">
              My, Oh My
            </h1>
            <p className="font-serif italic text-base text-[#987532] mt-0.5">Andheri West, Mumbai</p>
            <p className="text-xs text-[#A8A196] mt-1.5 flex items-center gap-1 font-mono">
              <MapPin className="w-3 h-3 text-[#C5A059] shrink-0" />
              Veera Desai, Andheri West, Mumbai
            </p>
          </div>

          {/* Search + Veg filter */}
          <div className="pb-4 flex gap-2.5">
            <div
              className={`relative flex-1 transition-all duration-200 ${
                searchFocused ? "ring-2 ring-[#C5A059]/30 rounded-2xl" : ""
              }`}
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A196]" />
              <input
                type="text"
                placeholder="Search dishes, drinks, desserts…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-2xl border border-[#EAE3D5] focus:outline-none focus:border-[#C5A059] text-[#171513] placeholder-[#B8B0A6] transition-all shadow-sm"
              />
            </div>

            <button
              type="button"
              onClick={onVegOnlyToggle}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                vegOnly
                  ? "bg-[#14532D] border-[#14532D] text-white shadow-md"
                  : "bg-white border-[#EAE3D5] text-[#423D37] hover:border-[#16A34A]/40"
              }`}
            >
              <Leaf className={`w-3.5 h-3.5 ${vegOnly ? "text-green-300" : "text-[#16A34A]"}`} />
              <span className="hidden sm:inline">Veg Only</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
