"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      {/* Decorative shapes */}
      <div className="fixed top-20 left-20 w-20 h-20 bg-[var(--accent-yellow)] border-[3px] border-[#1A1A1A] rounded-full opacity-60 hidden md:block" />
      <div className="fixed bottom-32 right-20 w-16 h-16 bg-[var(--accent-mint)] border-[3px] border-[#1A1A1A] rotate-45 opacity-60 hidden md:block" />
      <div className="fixed top-40 right-32 w-12 h-12 bg-[var(--accent-lavender)] border-[3px] border-[#1A1A1A] rounded-full opacity-60 hidden md:block" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
          <span className="text-xl font-bold tracking-tight">Pentaract Cloud</span>
        </Link>

        <div className="brutalist-card-static p-8">
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className={`border-[4px] p-4 mb-6 font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] ${
              error.startsWith("RESTRICTED:") 
              ? "bg-red-600 text-white border-black animate-shake" 
              : "bg-red-50 border-red-400 text-red-700"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {error.startsWith("RESTRICTED:") ? "🚫" : "🚨"}
                </span>
                <div className="flex-1">
                  <p className="uppercase text-xs font-black tracking-widest mb-1">
                    {error.startsWith("RESTRICTED:") ? "ACCOUNT RESTRICTED" : "SECURITY ALERT"}
                  </p>
                  <p className="text-sm">
                    {error.startsWith("RESTRICTED:") ? error.replace("RESTRICTED:", "").trim() : error}
                  </p>
                </div>
              </div>
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
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="brutalist-btn brutalist-btn-primary w-full"
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[var(--accent-coral)] font-semibold hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
