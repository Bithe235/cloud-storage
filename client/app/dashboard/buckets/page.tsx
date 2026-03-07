"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import Link from "next/link";

interface Bucket {
  id: string;
  name: string;
  region: string;
  createdAt: string;
  filesCount: number;
  totalSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function BucketsPage() {
  const { apiFetch } = useApi();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState("us-east-1");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadBuckets = useCallback(async () => {
    try {
      const data = await apiFetch("/api/buckets");
      setBuckets(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await apiFetch("/api/buckets", {
        method: "POST",
        body: JSON.stringify({ name: newName.toLowerCase(), region: newRegion }),
      });
      setShowCreate(false);
      setNewName("");
      await loadBuckets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bucket");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/buckets/${id}`, { method: "DELETE" });
      setDeleteId(null);
      await loadBuckets();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="brutalist-card-static p-6 text-center">
          <div className="text-3xl animate-bounce mb-2">🪣</div>
          <p className="font-medium text-sm">Loading buckets...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Buckets</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Manage your storage buckets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="brutalist-btn brutalist-btn-primary"
        >
          + Create Bucket
        </button>
      </div>

      {/* Buckets Grid */}
      {buckets.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buckets.map((bucket) => (
            <div key={bucket.id} className="brutalist-card p-5 relative group">
              <Link href={`/dashboard/buckets/${bucket.id}`} className="block">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rounded-lg flex items-center justify-center text-xl">
                    🪣
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{bucket.name}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{bucket.region}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">📄 {bucket.filesCount} files</span>
                  <span className="flex items-center gap-1">💾 {formatBytes(bucket.totalSize)}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-3">
                  Created {new Date(bucket.createdAt).toLocaleDateString()}
                </div>
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(bucket.id); }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 font-bold text-lg"
                title="Delete bucket"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="brutalist-card-static p-12 text-center">
          <div className="text-5xl mb-4">🪣</div>
          <h3 className="text-xl font-bold mb-2">No buckets yet</h3>
          <p className="text-[var(--text-muted)] mb-6">Create your first storage bucket to start uploading files</p>
          <button
            onClick={() => setShowCreate(true)}
            className="brutalist-btn brutalist-btn-primary"
          >
            + Create Your First Bucket
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Create New Bucket</h2>
            {error && (
              <div className="bg-red-50 border-[3px] border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Bucket Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="brutalist-input"
                  placeholder="my-project-data"
                  required
                  minLength={3}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Region</label>
                <select
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="brutalist-input"
                >
                  <option value="us-east-1">US East (Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">EU (Ireland)</option>
                  <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="brutalist-btn brutalist-btn-primary flex-1">
                  {creating ? "Creating..." : "Create Bucket"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="brutalist-btn brutalist-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">Delete Bucket?</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">
              This will permanently delete the bucket and all its files. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                className="brutalist-btn brutalist-btn-danger flex-1"
              >
                Delete Permanently
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="brutalist-btn brutalist-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
