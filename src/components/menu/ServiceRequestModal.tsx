"use client";

import React, { useState } from "react";
import { Bell, Droplets, UtensilsCrossed, Receipt, X, Check, Loader2 } from "lucide-react";
import { DiningTable } from "@/types/database";
import type { ServiceRequest } from "@/types/database";

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: DiningTable;
}

export function ServiceRequestModal({
  isOpen,
  onClose,
  table,
}: ServiceRequestModalProps) {
  const [selectedType, setSelectedType] = useState<"waiter" | "water" | "cutlery" | "bill">("water");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken: table.qr_token,
          type: selectedType,
          note: note.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error("Failed to request service:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#FDFBF7] rounded-3xl border border-[#EAE3D5] p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 text-[#6F6961] hover:text-[#171513] rounded-full hover:bg-[#F6F1E7] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#171513]">
              Request Dispatched!
            </h3>
            <p className="text-xs text-[#6F6961]">
              A service captain has been notified for <strong>{table.table_number}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-4 h-4 text-[#C5A059]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#987532]">
                  Table Assistance
                </span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#171513]">
                {table.table_number}
              </h3>
              <p className="text-xs text-[#6F6961] mt-0.5">
                What can we bring to your table?
              </p>
            </div>

            {/* Quick request buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { type: "water" as ServiceRequest["type"], label: "Drinking Water", icon: Droplets },
                { type: "waiter" as ServiceRequest["type"], label: "Call Captain", icon: Bell },
                { type: "cutlery" as ServiceRequest["type"], label: "Extra Cutlery", icon: UtensilsCrossed },
                { type: "bill" as ServiceRequest["type"], label: "Bring Bill", icon: Receipt },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedType(item.type)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#171513] text-white border-[#171513] shadow-md"
                        : "bg-white text-[#171513] border-[#EAE3D5] hover:border-[#C5A059]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? "text-[#DFC894]" : "text-[#987532]"}`} />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              placeholder="Specific notes (e.g. warm water, 4 spoons)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-white rounded-xl border border-[#EAE3D5] focus:outline-none focus:ring-2 focus:ring-[#C5A059] text-[#171513]"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#171513] hover:bg-[#2B2724] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C5A059]" />
                  <span>Notifying Staff...</span>
                </>
              ) : (
                <span>Send Request to Floor Staff</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
