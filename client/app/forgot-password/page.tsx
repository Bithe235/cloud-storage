"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://server.fahadakash.com/penta";
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process request");
      }

      setMessage(data.message || "Reset link sent!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
          <span className="text-xl font-bold tracking-tight">Pentaract Cloud</span>
        </Link>

        <div className="brutalist-card-static p-8">
          <h1 className="text-2xl font-bold mb-1">Reset Password</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Enter your email and we'll send you a link to reset your password.</p>

          {error && (
            <div className="bg-red-50 border-[3px] border-red-500 text-red-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(239,68,68,1)]">
              {error}
            </div>
          )}

          {message ? (
            <div className="bg-green-50 border-[3px] border-green-500 text-green-700 p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(34,197,94,1)]">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="brutalist-input"
                  placeholder="you@university.edu"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="brutalist-btn brutalist-btn-primary w-full"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            Remembered your password?{" "}
            <Link href="/login" className="text-[var(--accent-coral)] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
