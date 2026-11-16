"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, User, Phone, Mail, FileText, Banknote, Loader2, Sparkles } from "lucide-react";
import { DiningTable } from "@/types/database";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/formatters";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: DiningTable;
}

export function CheckoutModal({ isOpen, onClose, table }: CheckoutModalProps) {
  const router = useRouter();
  const { items, updateQuantity, totalPaise, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submissionRef = useRef<{ fingerprint: string; key: string } | null>(null);

  // Preload saved guest profile so repeat rounds require zero re-typing
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = localStorage.getItem("urban_kitchen_guest");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.name) setName(parsed.name);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.email) setEmail(parsed.email);
        }
      } catch {
        // Ignore invalid or unavailable saved guest details.
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage("Please enter your full name (at least 2 characters).");
      return;
    }
    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMessage("Please enter a valid 10-digit Indian phone number starting with 6-9.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address for your digital bill.");
      return;
    }
    if (items.length === 0) {
      setErrorMessage("Your cart is empty. Please select at least one item.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Save guest info locally for subsequent rounds
      try {
        localStorage.setItem(
          "urban_kitchen_guest",
          JSON.stringify({ name: name.trim(), phone: cleanPhone, email: email.trim().toLowerCase() })
        );
      } catch {
        // ignore
      }

      const orderPayload = {
        tableToken: table.qr_token,
        customer: {
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim().toLowerCase(),
        },
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions || undefined,
        })),
        specialInstructions: specialInstructions.trim() || undefined,
        paymentMethod: "counter" as const,
      };
      const fingerprint = JSON.stringify(orderPayload);
      if (submissionRef.current?.fingerprint !== fingerprint) {
        submissionRef.current = { fingerprint, key: crypto.randomUUID() };
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orderPayload, idempotencyKey: submissionRef.current.key }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to send order to kitchen. Please try again.");
      }

      // Order created!
      submissionRef.current = null;
      clearCart();
      const orderId = data.order?.id || data.order?.order_number;
      router.push(`/order/${orderId}?tableToken=${table.qr_token}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#FAF7F2] rounded-3xl border border-[#E8E2D5] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D5] bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#987532]">
                Dine-In Order
              </span>
            </div>
            <h2 className="font-serif text-xl font-bold text-[#1C1917]">
              Send Items to Kitchen
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Ordering for <strong className="text-[#1C1917]">{table.table_number}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716C] hover:bg-[#F3EFE6] hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Section 1: Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#987532]">
                1. Guest Information
              </h3>
              <span className="text-[10px] text-[#A8A29E]">Saved for your session</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative sm:col-span-2">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white rounded-xl border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#1C1917] placeholder-[#A8A29E]"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="Phone (10 digits)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white rounded-xl border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#1C1917] placeholder-[#A8A29E]"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                <input
                  type="email"
                  required
                  placeholder="Email for digital bill"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white rounded-xl border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#1C1917] placeholder-[#A8A29E]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Items in this round */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#987532]">
              2. Selected Dishes for this Round ({items.length})
            </h3>
            <div className="bg-white rounded-2xl border border-[#E8E2D5] divide-y divide-[#F5F2EB] p-1.5">
              {items.map((i) => (
                <div key={i.menuItem.id} className="p-2.5 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-[#1C1917] truncate">
                      {i.menuItem.name}
                    </h4>
                    <span className="text-[11px] text-[#78716C]">
                      {formatCurrency(i.menuItem.price_paise)} each
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(i.menuItem.id, i.quantity - 1)}
                      className="w-6 h-6 rounded-full bg-[#F3EFE6] text-[#1C1917] flex items-center justify-center text-xs font-bold hover:bg-[#E8E2D5]"
                    >
                      -
                    </button>
                    <span className="text-xs font-semibold w-4 text-center text-[#1C1917]">
                      {i.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(i.menuItem.id, i.quantity + 1)}
                      className="w-6 h-6 rounded-full bg-[#F3EFE6] text-[#1C1917] flex items-center justify-center text-xs font-bold hover:bg-[#E8E2D5]"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-xs sm:text-sm font-bold text-[#1C1917] w-18 text-right">
                    {formatCurrency(i.menuItem.price_paise * i.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Special Instructions */}
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-[#A8A29E]" />
              <textarea
                placeholder="Kitchen notes for this round (e.g. less spicy, bring with drinks, allergies)..."
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-white rounded-xl border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#1C1917] placeholder-[#A8A29E]"
              />
            </div>
          </div>

          {/* Section 3: Billing Notice (Pay at Counter Policy) */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E8E2D5] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#E8E2D5] flex items-center justify-center shrink-0 text-[#C5A059]">
              <Banknote className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-[#1C1917] block">
                Pay at Counter at the End of Dining
              </span>
              <p className="text-[#78716C] mt-0.5 leading-relaxed">
                Order multiple rounds at your own pace. All items will be added to your <strong>{table.table_number} Tab</strong>. Settle your total combined bill at the billing desk via Cash, UPI, or Card whenever you finish.
              </p>
            </div>
          </div>

          {/* Bill Calculation & Submit */}
          <div className="pt-3 border-t border-[#E8E2D5] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#78716C]">
              <span>This Round Total</span>
              <span className="font-bold text-[#1C1917] text-sm">{formatCurrency(totalPaise)}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#1C1917] hover:bg-[#33302B] text-[#FAF7F2] font-semibold text-xs sm:text-sm tracking-wide shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                  <span>Dispatching to Kitchen...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#C5A059]" />
                  <span>Place This Round & Send to Kitchen ({formatCurrency(totalPaise)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
