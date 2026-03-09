"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://server.fahadakash.com/penta";
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to rest password");
      }

      setMessage("Password successfully reset! You can now log in.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-red-50 border-[3px] border-red-500 text-red-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(239,68,68,1)] text-center">
        Invalid or missing reset token. Please request a new link.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-red-50 border-[3px] border-red-500 text-red-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(239,68,68,1)]">
          {error}
        </div>
      )}

      {message ? (
        <div className="bg-green-50 border-[3px] border-green-500 text-green-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(34,197,94,1)] text-center">
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="brutalist-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="brutalist-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="brutalist-btn brutalist-btn-primary w-full"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
          <span className="text-xl font-bold tracking-tight">Pentaract Cloud</span>
        </Link>

        <div className="brutalist-card-static p-8">
          <h1 className="text-2xl font-bold mb-1">Set New Password</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Enter your new reliable password below.</p>
          
          <Suspense fallback={<div className="text-center font-bold">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>

          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            <Link href="/login" className="text-[var(--accent-coral)] font-semibold hover:underline">
              Back to Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
