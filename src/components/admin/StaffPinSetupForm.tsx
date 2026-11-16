"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function StaffPinSetupForm({ token }: { token: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.history.replaceState(null, "", "/admin/pin/setup");
  }, []);

  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (pin !== confirmPin) {
      setError("The PIN entries do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/staff/pin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not set the PIN.");
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not set the PIN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#171513] px-4 py-10 text-[#FAF7F2]">
      <section className="w-full max-w-md rounded-2xl border border-[#3E3834] bg-[#211D19] p-6 shadow-2xl md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C5A059]">My, Oh My · Staff access</p>
        <h1 className="mt-3 text-2xl font-semibold">{success ? "PIN saved" : "Set your staff PIN"}</h1>
        {success ? (
          <>
            <p className="mt-3 text-sm leading-6 text-[#BDB6AA]">Your PIN is ready. Sign in to the Admin Desk or Kitchen using your new PIN.</p>
            <button type="button" onClick={() => router.push("/admin/login")} className="mt-6 w-full rounded-xl bg-[#C5A059] px-4 py-3 font-semibold text-[#171513] hover:bg-[#D5B875]">Go to staff login</button>
          </>
        ) : (
          <form onSubmit={submitPin} className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-[#BDB6AA]">Choose a unique 6–8 digit number that no other staff member uses. Avoid repeated digits or simple counting sequences.</p>
            <label className="block text-sm font-medium">
              New PIN
              <input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,8}" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} className="mt-1.5 w-full rounded-lg border border-[#51483E] bg-[#171513] px-3 py-3 text-lg tracking-[0.4em] outline-none focus:border-[#C5A059]" />
            </label>
            <label className="block text-sm font-medium">
              Confirm PIN
              <input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,8}" maxLength={8} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 8))} className="mt-1.5 w-full rounded-lg border border-[#51483E] bg-[#171513] px-3 py-3 text-lg tracking-[0.4em] outline-none focus:border-[#C5A059]" />
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>}
            <button disabled={!token || isSubmitting} className="w-full rounded-xl bg-[#C5A059] px-4 py-3 font-semibold text-[#171513] hover:bg-[#D5B875] disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? "Saving PIN…" : "Save PIN"}
            </button>
            {!token && <p className="text-sm text-red-200">This link is missing its setup token. Ask an admin to send a new one.</p>}
          </form>
        )}
      </section>
    </main>
  );
}
