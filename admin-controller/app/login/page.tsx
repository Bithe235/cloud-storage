"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:8040/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      if (data.user.role !== "admin") {
        throw new Error("Access Denied: Admin Role Required");
      }

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-yellow-200">
      <div className="brutalist-card max-w-md w-full p-8 bg-white border-8 border-black">
        <h1 className="text-5xl font-black mb-8 border-b-8 border-black pb-4 uppercase tracking-tighter italic">PENTARACT ADMIN</h1>
        
        {error && (
          <div className="bg-red-400 p-4 mb-6 border-4 border-black font-black uppercase text-sm">
            🚨 ERROR: {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-xl font-black uppercase mb-1 block">EMAIL ADDRESS</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="brutalist-input text-2xl" 
              placeholder="user@example.com"
              required
            />
          </div>
          <div>
            <label className="text-xl font-black uppercase mb-1 block">PASSWORD</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="brutalist-input text-2xl" 
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="w-full brutalist-btn bg-blue-500 text-white text-3xl font-black py-4 hover:bg-blue-600 active:translate-x-0">
            AUTHENTICATE
          </button>
        </form>
      </div>
    </div>
  );
}
