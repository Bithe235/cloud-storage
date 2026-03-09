"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { formatBytes } from "@/utils/format";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { apiFetch } = useApi();
  const [billing, setBilling] = useState<any>(null);
  const [counts, setCounts] = useState({ buckets: 0, apiKeys: 0 });
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [billingData, bucketsData, keysData] = await Promise.all([
          apiFetch("/api/billing"),
          apiFetch("/api/buckets"),
          apiFetch("/api/api-keys")
        ]);
        setBilling(billingData);
        setCounts({
          buckets: bucketsData?.length || 0,
          apiKeys: keysData?.length || 0
        });
      } catch (e) {
        console.error("Failed to load settings data", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [apiFetch]);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    alert("Password change feature coming soon!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const getPlanName = () => {
    if (user?.planId === "plan_1tb") return "Elite 5TB Plan";
    if (user?.planId === "plan_300gb") return "Business 4TB Plan";
    if (user?.planId === "plan_100gb") return "Pro 1.5TB Plan";
    return "Free 100GB Plan";
  };

  const storageUsed = billing?.used || 0;
  const storageLimit = billing?.limit || 107374182400; // 100GB fallback
  const storagePercent = Math.min(100, (storageUsed / storageLimit) * 100);

  return (
    <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Account Info */}
        <div className="brutalist-card-static p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            👤 Account Information
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-[var(--text-muted)] block mb-1">Email</label>
              <div className="brutalist-input bg-[var(--bg-secondary)]">{user?.email}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--text-muted)] block mb-1">Account ID</label>
              <div className="brutalist-input bg-[var(--bg-secondary)] font-mono text-xs">{user?.id}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--text-muted)] block mb-1">Plan</label>
              <div className="flex items-center gap-3">
                <div className={`brutalist-badge ${user?.planId !== 'plan_free' ? 'bg-[var(--accent-mint)]' : 'bg-[var(--accent-yellow)]'}`}>
                  {getPlanName()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Quota */}
        <div className="brutalist-card-static p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            📊 Usage & Quota
          </h2>
          <div className="space-y-4">
            {[
              { label: "Storage", used: formatBytes(storageUsed), limit: formatBytes(storageLimit), percent: storagePercent, color: "var(--accent-coral)" },
              { label: "Buckets", used: counts.buckets.toString(), limit: billing?.maxBuckets?.toString() || "3", percent: (counts.buckets / (billing?.maxBuckets || 3)) * 100, color: "var(--accent-mint)" },
              { label: "API Keys", used: counts.apiKeys.toString(), limit: billing?.maxApiKeys?.toString() || "2", percent: (counts.apiKeys / (billing?.maxApiKeys || 2)) * 100, color: "var(--accent-lavender)" },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[var(--text-muted)]">{item.used} / {item.limit}</span>
                </div>
                <div className="h-4 bg-[var(--bg-secondary)] border-2 border-[#1A1A1A] rounded-sm overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${item.percent}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="brutalist-card-static p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            🔒 Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="brutalist-input"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="brutalist-input"
                placeholder="Min. 6 characters"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="brutalist-input"
                placeholder="Repeat new password"
                required
              />
            </div>
            <button type="submit" className="brutalist-btn brutalist-btn-sky">
              Update Password
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="brutalist-card-static p-6 border-red-400">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-600">
            ⚠️ Danger Zone
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Signing out will clear your session. You can sign back in anytime.
          </p>
          <button
            onClick={logout}
            className="brutalist-btn brutalist-btn-danger"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
