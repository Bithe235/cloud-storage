"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-yellow-100 p-8">
        <div className="brutalist-card text-2xl font-black bounce">AUTHENTICATING...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-64 border-r-8 border-[var(--border)] bg-white flex flex-col">
        <div className="p-6 border-b-8 border-[var(--border)] bg-yellow-300">
          <h1 className="text-3xl font-black uppercase tracking-tighter">ADMIN CORE</h1>
          <p className="text-xs font-bold opacity-70">Pentaract Bridge v1.0</p>
        </div>

        <nav className="flex-1">
          <Link href="/admin/users" className="sidebar-link hover:bg-yellow-200">
            👥 Manage Users
          </Link>
          <Link href="/admin/buckets" className="sidebar-link hover:bg-green-200">
            🪣 System Buckets
          </Link>
          <Link href="/admin/settings" className="sidebar-link hover:bg-lavender-200 opacity-50 pointer-events-none">
            ⚙️ Bridge Config
          </Link>
        </nav>

        <div className="p-4 border-t-8 border-[var(--border)] bg-red-100">
          <div className="mb-4 text-xs font-black break-all uppercase">
            Logged as:<br/>
            <span className="text-sm border-b-2 border-black">{user.email}</span>
          </div>
          <button 
            onClick={logout}
            className="w-full brutalist-btn bg-red-500 text-white hover:bg-red-600 active:translate-x-0"
          >
            TERMINATE SESSION
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
