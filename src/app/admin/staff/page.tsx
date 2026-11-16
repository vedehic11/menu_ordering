"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { RefreshCw, UserPlus, Mail, UserCheck, UserX, Search, Clock3 } from "lucide-react";
import { formatDate } from "@/lib/formatters";

type ManagedStaff = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isActive: boolean;
  last_login_at: string | null;
  created_at: string;
};

const staffRoles = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "chef", label: "Chef" },
] as const;

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState("");
  const [canManageOwners, setCanManageOwners] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof staffRoles)[number]["value"]>("cashier");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"send-pin-setup" | "set-active" | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStaff = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);
    try {
      const response = await fetch("/api/admin/staff", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load staff accounts.");
      setStaff(body.staff);
      setCurrentStaffId(body.actor.id);
      setCanManageOwners(body.actor.canManageOwners);
      setDatabaseAvailable(true);
      setLastUpdated(new Date().toISOString());
      setLoadError("");
    } catch (loadError) {
      setDatabaseAvailable(false);
      setLoadError(loadError instanceof Error ? loadError.message : "Could not load staff accounts.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadStaff());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStaff();
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadStaff();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        !normalizedSearch ||
        member.name.toLocaleLowerCase().includes(normalizedSearch) ||
        (member.email || "").toLocaleLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? member.isActive : !member.isActive);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [roleFilter, search, staff, statusFilter]);

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create the staff account.");
      setName("");
      setEmail("");
      setNotice(`Account created. A secure PIN setup link was emailed to ${email}.`);
      await loadStaff();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Could not create the staff account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStaff = async (
    member: ManagedStaff,
    change: { action: "send-pin-setup" } | { action: "set-active"; isActive: boolean },
  ) => {
    if (
      change.action === "set-active" &&
      !change.isActive &&
      !window.confirm(`Deactivate ${member.name}? They will lose access immediately.`)
    ) {
      return;
    }

    setActionError("");
    setNotice("");
    setBusyStaffId(member.id);
    setBusyAction(change.action);
    try {
      const response = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...change, staffId: member.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update the staff account.");
      setNotice(
        change.action === "send-pin-setup"
          ? `A new PIN setup link was emailed to ${member.email}.`
          : `${member.name}'s account was ${change.isActive ? "activated" : "deactivated"}.`,
      );
      await loadStaff();
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : "Could not update the staff account.");
    } finally {
      setBusyStaffId(null);
      setBusyAction(null);
    }
  };

  const activeCount = staff.filter((member) => member.isActive).length;

  return (
    <div className="min-h-screen bg-[#F6F3ED] text-[#25211D]">
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-20 md:px-8 md:pb-10 md:pt-10">
        <div className="mb-6 flex flex-col gap-4 border-b border-[#E6E0D6] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9A7841]">Admin settings</p>
            <h1 className="mt-2 text-3xl font-semibold">Staff & PINs</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#706A62]">
              Invite your team, manage access, and send secure PIN setup links. PINs are never visible to admins.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {lastUpdated && (
              <span className="text-xs text-[#706A62]">
                Synced {formatDate(lastUpdated)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadStaff(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#DED8CE] bg-white px-3 py-2 text-sm font-medium hover:bg-[#FDFBF7] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        </div>

        {loadError && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>}
        {actionError && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <form onSubmit={submitInvite} className="mb-6 rounded-2xl border border-[#E6E0D6] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus className="h-5 w-5 text-[#9A7841]" /> Invite a team member</h2>
            <p className="text-xs text-[#706A62]">They set their PIN using a one-time email link.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">
              Full name
              <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#DAD3C8] px-3 py-2.5 font-normal outline-none focus:border-[#9A7841]" />
            </label>
            <label className="text-sm font-medium">
              Email
              <input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#DAD3C8] px-3 py-2.5 font-normal outline-none focus:border-[#9A7841]" />
            </label>
            <label className="text-sm font-medium">
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="mt-1.5 w-full rounded-lg border border-[#DAD3C8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#9A7841]">
                {staffRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <button disabled={isSubmitting || databaseAvailable !== true} className="mt-5 min-h-11 rounded-xl bg-[#25211D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3A332D] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? "Sending invitation…" : "Create account & send invite"}
          </button>
          {databaseAvailable === false && (
            <p className="mt-3 text-xs text-red-700">
              Staff changes are disabled until the staff service and database are available.
            </p>
          )}
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#E6E0D6] bg-white shadow-sm">
          <div className="border-b border-[#EEE9E1] px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Team accounts</h2>
                <p className="mt-1 text-sm text-[#706A62]">
                  {loadError && staff.length === 0
                    ? "Team data unavailable"
                    : `${activeCount} active · ${staff.length - activeCount} inactive`}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
                <label className="relative min-w-0">
                  <span className="sr-only">Search staff</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9288]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or email"
                    className="h-10 w-full rounded-lg border border-[#DAD3C8] bg-[#FDFBF7] pl-9 pr-3 text-sm outline-none focus:border-[#9A7841]"
                  />
                </label>
                <select
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="h-10 rounded-lg border border-[#DAD3C8] bg-white px-3 text-sm"
                >
                  <option value="all">All roles</option>
                  <option value="owner">Owner</option>
                  {staffRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="h-10 rounded-lg border border-[#DAD3C8] bg-white px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          {isLoading ? (
            <p className="px-5 py-8 text-sm text-[#706A62]">Loading staff accounts…</p>
          ) : filteredStaff.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[#706A62]">
              {loadError && staff.length === 0
                ? "The team list is unavailable until the staff service reconnects."
                : staff.length === 0
                  ? "No staff accounts yet. Invite your first team member above."
                  : "No team members match these filters."}
            </p>
          ) : (
            <ul className="divide-y divide-[#EEE9E1]">
              {filteredStaff.map((member) => (
                <li key={member.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{member.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${member.isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[#706A62]">
                      {member.email || "No email address"} <span className="px-1 text-[#B8B0A4]">·</span>
                      <span className="capitalize">{member.role}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[#8A837A]">
                      <Clock3 className="h-3.5 w-3.5" />
                      {member.last_login_at ? `Last sign-in ${formatDate(member.last_login_at)}` : "Never signed in"}
                      <span className="px-1 text-[#B8B0A4]">·</span>
                      Added {formatDate(member.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={databaseAvailable !== true || busyStaffId !== null || !member.email || !member.isActive || (member.role === "owner" && !canManageOwners)}
                      onClick={() => void updateStaff(member, { action: "send-pin-setup" })}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#DAD3C8] px-3 py-2 text-xs font-semibold hover:bg-[#F6F3ED] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyStaffId === member.id && busyAction === "send-pin-setup" ? (
                        <><RefreshCw className="h-4 w-4 animate-spin" /> Sending link…</>
                      ) : (
                        <><Mail className="h-4 w-4" /> Send PIN setup link</>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={databaseAvailable !== true || busyStaffId !== null || (member.role === "owner" && !canManageOwners) || (member.id === currentStaffId && member.isActive)}
                      onClick={() => void updateStaff(member, { action: "set-active", isActive: !member.isActive })}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#DAD3C8] px-3 py-2 text-xs font-semibold hover:bg-[#F6F3ED] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyStaffId === member.id && busyAction === "set-active" ? (
                        <><RefreshCw className="h-4 w-4 animate-spin" /> Updating…</>
                      ) : member.isActive ? (
                        <><UserX className="h-4 w-4" /> Deactivate</>
                      ) : (
                        <><UserCheck className="h-4 w-4" /> Activate</>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
