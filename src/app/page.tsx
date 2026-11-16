import React from "react";
import Link from "next/link";
import {
  QrCode,
  ChefHat,
  Utensils,
  Banknote,
  Flame,
  MapPin
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513] selection:bg-[#C5A059] selection:text-white">
      {/* Decorative Gold Header Filament */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#DFC894]/20 via-[#C5A059] to-[#DFC894]/20 opacity-90 z-50" />

      {/* Hero Section */}
      <header className="border-b border-[#EAE3D5] bg-[#FBF9F4] pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#C5A059]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#EAE3D5] text-xs font-semibold text-[#987532] mb-6 shadow-xs">
            <Flame className="w-3.5 h-3.5 text-[#C5A059]" />
            <span className="tracking-wide uppercase text-[11px] font-bold">
              Andheri West, Mumbai
            </span>
          </div>

          <h1 className="font-serif text-5xl sm:text-7xl font-bold text-[#171513] tracking-tight leading-none mb-2">
            My, Oh My
          </h1>
          <div className="font-serif italic text-2xl sm:text-3xl text-[#987532] font-normal mb-6">
            Good food, shared around the table
          </div>

          <p className="text-base sm:text-lg text-[#6F6961] max-w-2xl mx-auto font-light leading-relaxed mb-4">
            Live robata grills, 48-hour fermented sourdough pizzas, and craft botanical elixirs. Scan your table QR code to order round-by-round and settle at the counter whenever you&apos;re ready.
          </p>

          <p className="text-xs text-[#987532] font-medium flex items-center justify-center gap-1.5 mb-10">
            <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Off New Link Road, Veera Desai, Andheri West, Mumbai</span>
          </p>

          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <p className="inline-flex items-center gap-2 text-sm text-[#6F6961]">
              <QrCode className="h-4 w-4 text-[#C5A059]" />
              Scan the QR code at your table to view the menu and order.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-[#EAE3D5] bg-white px-5 py-3 text-sm font-semibold text-[#171513] shadow-xs transition-colors hover:border-[#C5A059] hover:bg-[#F6F1E7]"
            >
              <ChefHat className="h-4 w-4 text-[#C5A059]" />
              Staff sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Tables Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-[#EAE3D5] p-7 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#F6F1E7] border border-[#EAE3D5] flex items-center justify-center text-[#C5A059] mb-4">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#171513] mb-2">
              Live Robata & Sourdough
            </h3>
            <p className="text-xs text-[#6F6961] leading-relaxed font-light">
              Crafted in an open-theatre kitchen with 450°C wood-fired ovens, fresh hand-rolled pasta, and charcoal skewers.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#EAE3D5] p-7 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#F6F1E7] border border-[#EAE3D5] flex items-center justify-center text-[#C5A059] mb-4">
              <Utensils className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#171513] mb-2">
              Order at Your Pace
            </h3>
            <p className="text-xs text-[#6F6961] leading-relaxed font-light">
              Add orders whenever you like. Everything stays together on your table&apos;s bill.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#EAE3D5] p-7 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#F6F1E7] border border-[#EAE3D5] flex items-center justify-center text-[#C5A059] mb-4">
              <Banknote className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#171513] mb-2">
              Counter Table Billing
            </h3>
            <p className="text-xs text-[#6F6961] leading-relaxed font-light">
              All rounds aggregate onto your table&apos;s running bill. Pay seamlessly at the counter via Cash, UPI, or Card upon departure.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
