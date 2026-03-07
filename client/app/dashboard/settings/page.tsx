"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useState } from "react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  return (
    <div>
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
                <div className="brutalist-badge bg-[var(--accent-yellow)]">🎓 Student — Free</div>
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
              { label: "Storage", used: "0 B", limit: "5 GB", percent: 0, color: "var(--accent-coral)" },
              { label: "Buckets", used: "0", limit: "10", percent: 0, color: "var(--accent-mint)" },
              { label: "API Keys", used: "0", limit: "5", percent: 0, color: "var(--accent-lavender)" },
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
