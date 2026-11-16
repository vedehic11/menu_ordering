"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  ChefHat,
  History,
  Users,
  QrCode,
  Volume2,
  VolumeX,
  LogOut,
  User,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

interface AdminNavProps {
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  pendingRequestsCount?: number;
  billRequestsCount?: number;
}

const NAV_LINKS = [
  {
    href: "/admin/counter",
    label: "Admin Desk",
    shortLabel: "Admin",
    icon: Banknote,
    description: "Table orders, billing and print bills",
    color: "text-amber-400",
    badgeKey: "bill",
  },
  {
    href: "/admin/kitchen",
    label: "Kitchen KDS",
    shortLabel: "Kitchen",
    icon: ChefHat,
    description: "Live kitchen display",
    color: "text-orange-400",
    badgeKey: null,
  },
  {
    href: "/admin/history",
    label: "Visit History",
    shortLabel: "History",
    icon: History,
    description: "Search past visits, orders and payments",
    color: "text-emerald-400",
    badgeKey: null,
  },
  {
    href: "/admin/staff",
    label: "Staff & PINs",
    shortLabel: "Staff",
    icon: Users,
    description: "Manage staff accounts and PIN access",
    color: "text-sky-400",
    badgeKey: null,
  },
];

export function AdminNav({
  soundEnabled = true,
  onToggleSound,
  pendingRequestsCount = 0,
  billRequestsCount = 0,
}: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [staffName, setStaffName] = useState("Staff");
  const [staffRole, setStaffRole] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setStaffName(localStorage.getItem("staff_name") || "Staff");
      setStaffRole(localStorage.getItem("staff_role") || "");
    });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/staff/logout", { method: "POST" });
    localStorage.removeItem("staff_name");
    localStorage.removeItem("staff_role");
    router.push("/admin/login");
  };

  const getBadge = (badgeKey: string | null) => {
    if (badgeKey === "bill" && billRequestsCount > 0) return billRequestsCount;
    if (badgeKey === "service" && pendingRequestsCount > 0) return pendingRequestsCount;
    return null;
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/admin/counter" && (pathname === "/admin" || pathname === "/admin/counter"));
  const visibleNavLinks = NAV_LINKS.filter(
    (link) =>
      (link.href !== "/admin/staff" || ["owner", "manager"].includes(staffRole)) &&
      (link.href !== "/admin/history" || ["owner", "manager", "cashier"].includes(staffRole)),
  );

  return (
    <>
      {/* ══════════════════════════════════════
          DESKTOP: Left Sidebar
      ══════════════════════════════════════ */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#171513] border-r border-[#2C2724] fixed left-0 top-0 bottom-0 z-40">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-[#2C2724]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#DFC894] to-[#987532] flex items-center justify-center text-[#171513] font-serif font-black text-sm shadow-md shrink-0">
              MO
            </div>
            <div className="min-w-0">
              <div className="font-serif text-sm font-bold text-[#FAF7F2] truncate">My, Oh My</div>
              <div className="text-[10px] text-[#6F6961] font-mono truncate">Staff</div>
            </div>
          </div>
        </div>

        {/* Staff identity */}
        {staffRole && (
          <div className="mx-3 mt-3 mb-1 px-3 py-2.5 rounded-xl bg-[#1E1B18] border border-[#2C2724]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#2C2724] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[#DFC894]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#FAF7F2] truncate">{staffName}</div>
                <div className="text-[10px] text-[#A8A196] capitalize font-mono">{staffRole}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            const badge = getBadge(link.badgeKey);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  active
                    ? "bg-[#2C2724] text-[#DFC894] shadow-inner border border-[#3E3834]"
                    : "text-[#A8A196] hover:text-[#FAF7F2] hover:bg-[#1E1B18]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#DFC894]" : link.color} opacity-80 group-hover:opacity-100`} />
                <span className="flex-1 font-medium truncate">{link.label}</span>
                {badge && (
                  <span className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shrink-0">
                    {badge}
                  </span>
                )}
                {active && <ChevronRight className="w-3.5 h-3.5 text-[#6F6961] shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer Controls */}
        <div className="px-2 py-3 border-t border-[#2C2724] space-y-1">
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-[#A8A196] hover:text-[#FAF7F2] hover:bg-[#1E1B18] transition cursor-pointer"
            >
              {soundEnabled
                ? <Volume2 className="w-4 h-4 text-[#DFC894]" />
                : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? "Sound On" : "Sound Off"}</span>
            </button>
          )}
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-[#A8A196] hover:text-[#FAF7F2] hover:bg-[#1E1B18] transition cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Customer View</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-[#A8A196] hover:text-red-400 hover:bg-red-950/20 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MOBILE: Top Bar + Bottom Tab Bar
      ══════════════════════════════════════ */}

      {/* Mobile Top Bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#171513] border-b border-[#2C2724] flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DFC894] to-[#987532] flex items-center justify-center text-[#171513] font-serif font-black text-xs">
            MO
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate font-serif text-sm font-bold text-[#FAF7F2]">My, Oh My</span>
            {staffRole && (
              <span className="mt-0.5 block text-[9px] text-[#A8A196] capitalize font-mono">{staffRole}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="p-2 rounded-lg text-[#A8A196] hover:text-[#DFC894] transition"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#A8A196] hover:text-[#FAF7F2] transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile full-screen overlay menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#171513] flex flex-col pt-14">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {/* Staff card */}
            {staffRole && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#1E1B18] border border-[#2C2724] mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DFC894] to-[#987532] flex items-center justify-center text-[#171513] font-black text-sm">
                  {staffName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#FAF7F2]">{staffName}</div>
                  <div className="text-xs text-[#A8A196] capitalize font-mono">{staffRole} · My, Oh My</div>
                </div>
              </div>
            )}

            {visibleNavLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              const badge = getBadge(link.badgeKey);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                    active
                      ? "bg-[#2C2724] text-[#DFC894] border border-[#3E3834]"
                      : "text-[#A8A196] hover:text-[#FAF7F2] hover:bg-[#1E1B18]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? "bg-[#3E3834]" : "bg-[#1E1B18]"}`}>
                    <Icon className={`w-5 h-5 ${active ? "text-[#DFC894]" : link.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{link.label}</div>
                    <div className="text-[11px] text-[#6F6961] mt-0.5">{link.description}</div>
                  </div>
                  {badge && (
                    <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
                      {badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#3E3834]" />
                </Link>
              );
            })}
          </div>

          <div className="px-4 py-4 border-t border-[#2C2724] space-y-2">
            <Link
              href="/"
              target="_blank"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-[#A8A196] hover:text-[#FAF7F2] hover:bg-[#1E1B18] transition"
            >
              <QrCode className="w-5 h-5" />
              <span>Customer View</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm text-red-400 hover:bg-red-950/20 transition cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#171513]/98 backdrop-blur-xl border-t border-[#2C2724]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex">
          {visibleNavLinks.filter((link) => link.href !== "/admin/staff").map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            const badge = getBadge(link.badgeKey);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all ${
                  active ? "text-[#DFC894]" : "text-[#6F6961] hover:text-[#A8A196]"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#C5A059]" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge && (
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold leading-none">{link.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
