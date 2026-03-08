"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { formatBytes } from "@/utils/format";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

interface BucketSummary {
  id: string;
  name: string;
  filesCount: number;
  totalSize: number;
}

interface ApiKeySummary {
  id: string;
  name: string;
}



export default function DashboardPage() {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const [buckets, setBuckets] = useState<BucketSummary[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [b, k] = await Promise.all([
          apiFetch("/api/buckets"),
          apiFetch("/api/api-keys"),
        ]);
        setBuckets(b || []);
        setApiKeys(k || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [apiFetch]);

  const totalFiles = buckets.reduce((a, b) => a + b.filesCount, 0);
  const totalSize = buckets.reduce((a, b) => a + b.totalSize, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="brutalist-card-static p-6 text-center">
          <div className="text-3xl animate-bounce mb-2">☁️</div>
          <p className="font-medium text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome back! 👋</h1>
        <p className="text-[var(--text-muted)] mt-1">{user?.email}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Buckets", value: buckets.length.toString(), icon: "🪣", color: "var(--accent-coral)" },
          { label: "Files", value: totalFiles.toString(), icon: "📄", color: "var(--accent-mint)" },
          { label: "Storage Used", value: formatBytes(totalSize), icon: "💾", color: "var(--accent-sky)" },
          { label: "API Keys", value: apiKeys.length.toString(), icon: "🔑", color: "var(--accent-lavender)" },
        ].map((stat, i) => (
          <div key={i} className="brutalist-card-static p-5">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 border-[#1A1A1A]"
                style={{ background: stat.color }}
              >
                {stat.icon}
              </div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/buckets" className="brutalist-card p-6 block">
          <div className="text-3xl mb-3">🪣</div>
          <h3 className="font-bold text-lg mb-1">Create Bucket</h3>
          <p className="text-sm text-[var(--text-muted)]">Set up a new storage bucket for your project</p>
        </Link>
        <Link href="/dashboard/api-keys" className="brutalist-card p-6 block">
          <div className="text-3xl mb-3">🔑</div>
          <h3 className="font-bold text-lg mb-1">Generate API Key</h3>
          <p className="text-sm text-[var(--text-muted)]">Get an API key to integrate with your app</p>
        </Link>
        <Link href="/dashboard/buckets" className="brutalist-card p-6 block">
          <div className="text-3xl mb-3">📁</div>
          <h3 className="font-bold text-lg mb-1">Upload Files</h3>
          <p className="text-sm text-[var(--text-muted)]">Drag and drop files into any bucket</p>
        </Link>
      </div>

      {/* Recent Buckets */}
      {buckets.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Your Buckets</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buckets.slice(0, 6).map((bucket) => (
              <Link
                key={bucket.id}
                href={`/dashboard/buckets/${bucket.id}`}
                className="brutalist-card p-5 block"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🪣</span>
                  <span className="font-bold truncate">{bucket.name}</span>
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                  <span>{bucket.filesCount} files</span>
                  <span>{formatBytes(bucket.totalSize)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {buckets.length === 0 && (
        <div className="brutalist-card-static p-12 text-center">
          <div className="text-5xl mb-4">☁️</div>
          <h3 className="text-xl font-bold mb-2">No buckets yet</h3>
          <p className="text-[var(--text-muted)] mb-6">Create your first bucket to start storing files</p>
          <Link href="/dashboard/buckets" className="brutalist-btn brutalist-btn-primary">
            Create Your First Bucket →
          </Link>
        </div>
      )}
    </div>
  );
}
