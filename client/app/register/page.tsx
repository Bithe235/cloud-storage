"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      // Backend now sends an email and expects OTP verification instead of logging in directly.
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="fixed top-20 right-20 w-20 h-20 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rounded-full opacity-60 hidden md:block" />
      <div className="fixed bottom-20 left-20 w-16 h-16 bg-[var(--accent-sky)] border-[3px] border-[#1A1A1A] rotate-12 opacity-60 hidden md:block" />

      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
          <span className="text-xl font-bold tracking-tight">Pentaract Cloud</span>
        </Link>

        <div className="brutalist-card-static p-8">
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Start using cloud storage for free</p>

          {error && (
            <div className="bg-red-50 border-[3px] border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 text-sm font-medium">
              {error}
            </div>
          )}

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
            <div>
              <label className="text-sm font-semibold mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="brutalist-input"
                placeholder="Min. 6 characters"
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
                placeholder="Repeat your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="brutalist-btn brutalist-btn-primary w-full"
            >
              {loading ? "Creating account..." : "Create Account →"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--accent-coral)] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4">
          🎓 Free for students. No credit card required.
        </p>
      </div>
    </div>
  );
}
