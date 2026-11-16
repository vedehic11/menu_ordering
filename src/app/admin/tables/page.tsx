"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  QrCode,
  Printer,
  Download,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";
import { DiningTable } from "@/types/database";

export default function TablesQrDesk() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [printStandee, setPrintStandee] = useState<{
    table: DiningTable;
    qrSrc: string;
  } | null>(null);

  useEffect(() => {
    const loadTablesAndGenerateQrs = async () => {
      try {
        const response = await fetch("/api/tables");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load table QR codes.");

        const activeTables: DiningTable[] = data.tables || [];
        setTables(activeTables);
        const urls: Record<string, string> = {};
        for (const table of activeTables) {
          urls[table.id] = await QRCode.toDataURL(
            `${window.location.origin}/menu/${table.qr_token}`,
            {
              width: 512,
              margin: 2,
              color: { dark: "#171513", light: "#FFFFFF" },
            },
          );
        }
        setQrImages(urls);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load table QR codes.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTablesAndGenerateQrs();
  }, []);

  const handleDownloadQr = (table: DiningTable) => {
    const dataUrl = qrImages[table.id];
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `my-oh-my-${table.table_number.toLowerCase().replace(/[^a-z0-9]/g, "-")}-qr.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#171513]">
      <AdminNav />

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-20 pb-28 sm:px-6 md:py-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE3D5]">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#171513]">
              Table Standee QR Generator
            </h1>
            <p className="text-xs text-[#6F6961] mt-0.5">
              {tables.length} active tables • High-definition QR standees • Ready for acrylic table stands
            </p>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {loadError}
          </div>
        )}

        {/* Tables Grid */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[#6F6961]">Loading active tables…</div>
        ) : tables.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-dashed border-[#D9D2C5] bg-white py-12 text-center text-sm text-[#6F6961]">
            No active tables are configured.
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => {
            const qrSrc = qrImages[table.id];
            return (
              <div
                key={table.id}
                className="bg-white rounded-3xl border border-[#EAE3D5] p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-[#C5A059] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#A8A196] uppercase font-bold tracking-wider">
                      Active QR Standee
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold">
                      Live
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-lg text-[#171513] mt-1">
                    {table.table_number}
                  </h3>
                  <p className="text-[11px] text-[#6F6961] font-mono truncate mt-0.5">
                    Token: {table.qr_token.substring(0, 18)}...
                  </p>
                </div>

                {/* QR Preview Card */}
                <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EAE3D5] flex flex-col items-center text-center">
                  <div className="w-44 h-44 bg-white p-2.5 rounded-xl border border-[#EAE3D5] shadow-xs flex items-center justify-center">
                    {qrSrc ? (
                      <img
                        src={qrSrc}
                        alt={`QR for ${table.table_number}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-[#A8A196] font-mono animate-pulse">
                        Generating QR...
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6F6961] mt-3 font-medium">
                    Scan with any camera app to open menu
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-[#EAE3D5]">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => qrSrc && setPrintStandee({ table, qrSrc })}
                      className="py-2 px-3 rounded-xl bg-[#171513] text-[#FAF7F2] text-xs font-semibold hover:bg-[#33302B] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#DFC894]" />
                      <span>Print Standee</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadQr(table)}
                      className="py-2 px-3 rounded-xl border border-[#D9D2C5] bg-white text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#987532]" />
                      <span>Download PNG</span>
                    </button>
                  </div>

                  <Link
                    href={`/menu/${table.qr_token}`}
                    target="_blank"
                    className="w-full py-2 px-3 rounded-xl border border-transparent hover:border-[#EAE3D5] text-[11px] font-semibold text-[#987532] hover:bg-[#FAF7F2] transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Test Guest Menu Directly</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* PRINT STANDEE MODAL */}
      {printStandee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#EAE3D5] p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE3D5]">
              <span className="text-xs font-mono font-bold uppercase text-[#A8A196]">
                Table Standee Preview
              </span>
              <button
                type="button"
                onClick={() => setPrintStandee(null)}
                className="p-1 rounded-lg text-[#6F6961] hover:text-[#171513]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Standee Artwork Card */}
            <div className="p-6 rounded-2xl bg-[#171513] text-[#FAF7F2] text-center space-y-4 border border-[#3E3834] shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#DFC894] font-bold">
                  Contactless Ordering
                </span>
                <h2 className="font-serif text-2xl font-black text-white">
                  My, Oh My
                </h2>
                <p className="text-[11px] text-[#A8A196]">
                  Andheri West, Mumbai
                </p>
              </div>

              <div className="w-48 h-48 bg-white p-3 rounded-2xl mx-auto shadow-inner flex items-center justify-center">
                <img
                  src={printStandee.qrSrc}
                  alt="Standee QR"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-1">
                <div className="font-serif font-bold text-base text-[#DFC894]">
                  {printStandee.table.table_number}
                </div>
                <p className="text-[11px] text-[#A8A196] leading-tight">
                  Scan to order multiple food rounds directly to the live kitchen.
                </p>
                <p className="text-[10px] text-[#DFC894] font-mono pt-1">
                  PAY AT COUNTER • CASH · UPI · CARD
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrintStandee(null)}
                className="py-2.5 px-4 flex-1 rounded-xl border border-[#D9D2C5] text-xs font-semibold text-[#171513] hover:bg-[#FAF7F2]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 flex-1 rounded-xl bg-[#171513] text-[#FAF7F2] text-xs font-semibold hover:bg-[#33302B] flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Standee</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
