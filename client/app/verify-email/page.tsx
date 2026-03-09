"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");

  const [email] = useState(emailParam || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Email is missing. Please restart registration or login.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://server.fahadakash.com/penta";
      const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify email");
      }

      setMessage("Email verified successfully! Logging you in...");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError("");
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://server.fahadakash.com/penta";
      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to resend code");
      }

      setMessage(data.message || "A new code has been sent.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="bg-red-50 border-[3px] border-red-500 text-red-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(239,68,68,1)] text-center">
        No email provided. <br/><br/>
        <Link href="/login" className="underline">Go to Login</Link>
      </div>
    );
  }

  return (
    <>
      <p className="font-semibold text-center mb-6">
        Code sent to: <span className="p-1 bg-[#1A1A1A] text-[var(--accent-mint)] border border-[var(--border-color)]">{email}</span>
      </p>

      {error && (
        <div className="bg-red-50 border-[3px] border-red-500 text-red-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(239,68,68,1)]">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-50 border-[3px] border-green-500 text-green-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(34,197,94,1)] text-center">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold mb-1 block">6-Digit Code</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.toUpperCase())}
            className="brutalist-input text-center text-xl tracking-[0.5em] font-mono"
            placeholder="XXXXXX"
            maxLength={6}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || resending}
          className="brutalist-btn brutalist-btn-primary w-full"
        >
          {loading ? "Verifying..." : "Verify Account"}
        </button>
      </form>

      <div className="mt-8 text-center pt-6 border-t-[3px] border-[#1A1A1A] border-dashed">
        <p className="text-sm text-[var(--text-muted)] mb-2">Didn't receive the code?</p>
        <button
          onClick={handleResend}
          disabled={resending || loading}
          className="text-xs font-bold uppercase tracking-wider text-[var(--text-color)] hover:text-[var(--accent-coral)] transition-colors disabled:opacity-50"
        >
          {resending ? "Sending..." : "Resend Code"}
        </button>
      </div>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
          <span className="text-xl font-bold tracking-tight">Pentaract Cloud</span>
        </Link>

        <div className="brutalist-card-static p-8 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 text-[100px] opacity-10 rotate-12 select-none pointer-events-none">
            📧
          </div>

          <h1 className="text-2xl font-bold mb-1 relative z-10">Verify Email</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6 relative z-10">
            Please enter the 6-digit code we sent to your email.
          </p>
          
          <Suspense fallback={<div className="text-center font-bold">Loading...</div>}>
            <VerifyEmailForm />
          </Suspense>

        </div>
      </div>
    </div>
  );
}
