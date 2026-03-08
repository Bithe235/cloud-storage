"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useApi } from "../../lib/useApi";

interface Notification {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/buckets", label: "Buckets", icon: "🪣" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "🔑" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { apiFetch } = useApi();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch("/api/notifications");
      setNotifications(data || []);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchNotifications();
      // Polling every 60 seconds
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user, isLoading, router, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="brutalist-card-static p-8 text-center">
          <div className="text-4xl mb-4 animate-bounce">☁️</div>
          <p className="font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen grid-bg flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r-[3px] border-[#1A1A1A] flex flex-col z-40 transition-transform md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b-[3px] border-[#1A1A1A]">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
            <span className="text-lg font-bold tracking-tight">Pentaract</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t-[3px] border-[#1A1A1A]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-[var(--accent-lavender)] border-2 border-[#1A1A1A] rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user.email ? user.email[0].toUpperCase() : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.email}</p>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                {user.planId === "plan_1tb" ? "Pro 1TB Plan" : 
                 user.planId === "plan_300gb" ? "Standard 300GB" :
                 user.planId === "plan_100gb" ? "Basic 100GB" : "Free 50GB Tier"}
              </p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push("/"); }}
            className="brutalist-btn brutalist-btn-secondary brutalist-btn-sm w-full"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {user.planExpiresAt && (
          new Date(user.planExpiresAt) < new Date() ? (
            <div className="bg-red-600 text-white p-3 text-center border-b-[3px] border-black font-black uppercase tracking-tighter text-sm">
              🚨 SYSTEM ALERT: YOUR SUBSCRIPTION EXPIRED ON {new Date(user.planExpiresAt).toLocaleDateString()}. ALL UPLOADS DISABLED. 
              <Link href="/dashboard/billing" className="ml-3 underline decoration-white decoration-2 underline-offset-4 hover:bg-white hover:text-red-600 transition-colors px-2 py-1">
                RENEW PLAN NOW →
              </Link>
            </div>
          ) : (
            <div className="bg-[var(--accent-mint)] text-[#1A1A1A] p-2 text-center border-b-[3px] border-black font-bold text-[10px] uppercase tracking-widest">
              ✨ Account Current: {Math.max(0, Math.ceil((new Date(user.planExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} Days Remaining
            </div>
          )
        )}

        {/* Mobile header */}
        <header className="md:hidden border-b-[3px] border-[#1A1A1A] bg-white p-4 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="brutalist-btn brutalist-btn-secondary brutalist-btn-sm"
          >
            ☰
          </button>
          <span className="font-bold">Pentaract</span>
          <div className="w-8" />
        </header>

        <main className="flex-1 p-6 md:p-8">
          {/* Notifications Area */}
          <div className="mb-6 space-y-3">
            {notifications.filter(n => !n.isRead).map((n) => (
              <div
                key={n.id}
                className={`flex items-center justify-between p-4 border-[3px] border-black brutalist-card-static !shadow-none ${
                  n.type === "error" || n.type === "alert" ? "bg-red-50 border-red-600" :
                  n.type === "warning" ? "bg-orange-50 border-orange-600" : "bg-blue-50 border-blue-600"
                }`}
              >
                <div className="flex gap-3 items-start">
                  <span className="text-xl">
                    {n.type === "error" || n.type === "alert" ? "🚨" : n.type === "warning" ? "⚠️" : "📢"}
                  </span>
                  <div>
                    <p className={`font-bold text-sm ${
                      n.type === "error" || n.type === "alert" ? "text-red-700" :
                      n.type === "warning" ? "text-orange-700" : "text-blue-700"
                    }`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] opacity-60 font-medium">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => markAsRead(n.id)}
                  className="text-xs font-black uppercase hover:underline ml-4 whitespace-nowrap"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
