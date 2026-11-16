"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "admin", label: "Admin Desk", emoji: "🧾" },
  { value: "kitchen", label: "Kitchen", emoji: "👨‍🍳" },
];

export default function StaffLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Keep staff on the view for their authenticated role.
    fetch("/api/auth/staff/me")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        router.replace(data.staff?.role === "chef" ? "/admin/kitchen" : "/admin/counter");
      })
      .catch(() => {});
  }, [router]);

  const handlePinInput = (digit: string) => {
    if (pin.length < 8) setPin((p) => p + digit);
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleLogin = async () => {
    if (!pin || !role) {
      setError("Please select a role and enter your PIN.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed. Check your PIN.");
        setPin("");
      } else {
        // Store role/name in localStorage for UI use
        localStorage.setItem("staff_role", data.staff?.role || role);
        localStorage.setItem("staff_name", data.staff?.name || "Staff");
        router.push(role === "kitchen" ? "/admin/kitchen" : "/admin/counter");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #171513 0%, #2a2016 50%, #171513 100%)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Decorative gold line */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, transparent, #C5A059, transparent)",
        }}
      />

      <div
        style={{
          background: "rgba(253,251,247,0.03)",
          border: "1px solid rgba(197,160,89,0.2)",
          borderRadius: "24px",
          padding: "clamp(24px, 8vh, 40px) clamp(20px, 8vw, 40px)",
          width: "100%",
          maxWidth: "420px",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            style={{
              fontSize: "13px",
              letterSpacing: "4px",
              color: "#C5A059",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            My, Oh My
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "28px",
              color: "#FDFBF7",
              margin: "0 0 4px",
              fontWeight: 600,
            }}
          >
            Staff Login
          </h1>
          <p style={{ color: "rgba(253,251,247,0.4)", fontSize: "14px", margin: 0 }}>
            My, Oh My
          </p>
        </div>

        {/* Role Selector */}
        <div className="mb-6">
          <label
            style={{ color: "rgba(253,251,247,0.6)", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}
          >
            Select Role
          </label>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                style={{
                  padding: "10px 4px",
                  borderRadius: "10px",
                  border: role === r.value ? "2px solid #C5A059" : "1px solid rgba(197,160,89,0.2)",
                  background: role === r.value ? "rgba(197,160,89,0.15)" : "transparent",
                  color: role === r.value ? "#C5A059" : "rgba(253,251,247,0.5)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "18px" }}>{r.emoji}</span>
                <span style={{ fontSize: "10px", fontWeight: 600 }}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* PIN Display */}
        <div className="mb-6">
          <label
            style={{ color: "rgba(253,251,247,0.6)", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}
          >
            Enter PIN
          </label>
          <div
            className="flex justify-center gap-3 mt-3"
            style={{ minHeight: "48px", alignItems: "center" }}
          >
            {pin.length === 0 ? (
              <span style={{ color: "rgba(253,251,247,0.2)", fontSize: "14px" }}>
                Enter your PIN below
              </span>
            ) : (
              Array.from({ length: pin.length }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#C5A059",
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key) => (
            <button
              key={key}
              onClick={() => key === "⌫" ? handleDelete() : key !== "" ? handlePinInput(key) : undefined}
              disabled={key === ""}
              style={{
                height: "56px",
                borderRadius: "12px",
                border: "1px solid rgba(197,160,89,0.15)",
                background: key === "⌫"
                  ? "rgba(197,160,89,0.1)"
                  : key === ""
                  ? "transparent"
                  : "rgba(253,251,247,0.05)",
                color: key === "⌫" ? "#C5A059" : "#FDFBF7",
                fontSize: key === "⌫" ? "20px" : "22px",
                fontWeight: 500,
                cursor: key === "" ? "default" : "pointer",
                transition: "all 0.1s",
                borderColor: key === "" ? "transparent" : undefined,
              }}
              onMouseDown={(e) => {
                if (key !== "") {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(197,160,89,0.2)";
                }
              }}
              onMouseUp={(e) => {
                if (key !== "⌫" && key !== "") {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(253,251,247,0.05)";
                } else if (key === "⌫") {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(197,160,89,0.1)";
                }
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#fca5a5",
              fontSize: "13px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoading || pin.length < 4 || !role}
          style={{
            width: "100%",
            height: "52px",
            borderRadius: "12px",
            border: "none",
            background:
              isLoading || pin.length < 4 || !role
                ? "rgba(197,160,89,0.2)"
                : "linear-gradient(135deg, #C5A059, #DFC894)",
            color: isLoading || pin.length < 4 || !role ? "rgba(197,160,89,0.4)" : "#171513",
            fontSize: "15px",
            fontWeight: 700,
            cursor: isLoading || pin.length < 4 || !role ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            letterSpacing: "0.5px",
          }}
        >
          {isLoading ? "Verifying…" : "Sign In to Dashboard"}
        </button>

        <p style={{ textAlign: "center", marginTop: "24px", color: "rgba(253,251,247,0.2)", fontSize: "12px" }}>
          Secure staff access only · My, Oh My
        </p>
      </div>
    </div>
  );
}
