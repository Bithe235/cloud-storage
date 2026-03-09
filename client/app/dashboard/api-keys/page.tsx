"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "../../context/AuthContext";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  key?: string; // used for newly created raw key
  rawKey?: string; // from backend response
  permissions: string;
  createdAt: string;
  lastUsed: string | null;
  isActive: boolean;
}

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { apiFetch, baseUrl } = useApi();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [permissions, setPermissions] = useState({
    read: true,
    write: false,
    delete: false
  });
  const [creating, setCreating] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  const loadKeys = useCallback(async () => {
    try {
      const data = await apiFetch("/api/api-keys");
      setKeys(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user?.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
      alert("Subscription expired! Key generation disabled.");
      return;
    }

    setCreating(true);
    
    // Convert permissions object to comma-separated string
    const perms = Object.entries(permissions)
      .filter(([_, val]) => val)
      .map(([key]) => key)
      .join(",");

    try {
      const res = await apiFetch("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ 
          name: newKeyName,
          permissions: perms 
        }),
      });
      
      // The backend returns { apiKey: {...}, rawKey: "..." }
      const newKey = {
        ...res.apiKey,
        key: res.rawKey // map rawKey to key for the UI
      };

      setNewlyCreated(newKey);
      setShowCreate(false);
      setNewKeyName("");
      // Reset permissions
      setPermissions({ read: true, write: false, delete: false });
      await loadKeys();
    } catch (e) {
      console.error(e);
      alert("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Revoke this API key? Apps using it will stop working.")) return;
    try {
      await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      await loadKeys();
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="brutalist-card-static p-6 text-center">
          <div className="text-3xl animate-bounce mb-2">🔑</div>
          <p className="font-medium text-sm">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Manage keys for programmatic access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="brutalist-btn brutalist-btn-primary">
          + Generate Key
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("keys")}
          className={`brutalist-btn brutalist-btn-sm ${activeTab === "keys" ? "brutalist-btn-primary" : "brutalist-btn-secondary"}`}
        >
          🔑 Your Keys
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`brutalist-btn brutalist-btn-sm ${activeTab === "docs" ? "brutalist-btn-primary" : "brutalist-btn-secondary"}`}
        >
          📖 Integration Docs
        </button>
      </div>

      {activeTab === "keys" ? (
        <>
          {/* Newly Created Key Alert */}
          {newlyCreated && (
            <div className="brutalist-card-static p-5 mb-6 bg-[var(--accent-yellow)] border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚠️</span>
                <h3 className="font-bold">Save your API key now!</h3>
              </div>
              <p className="text-sm mb-3">This key won&apos;t be shown again. Copy it to a safe place.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-4 py-2 rounded font-mono text-sm border-2 border-[#1A1A1A] break-all">
                  {newlyCreated.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newlyCreated.key || "")}
                  className="brutalist-btn brutalist-btn-secondary brutalist-btn-sm"
                >
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>
              <button
                onClick={() => setNewlyCreated(null)}
                className="text-sm font-medium mt-3 hover:underline"
              >
                I&apos;ve saved it →
              </button>
            </div>
          )}

          {/* Keys List */}
          {keys.length > 0 ? (
            <div className="space-y-3">
              {keys.map((key) => (
                <div key={key.id} className="brutalist-card-static p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--accent-lavender)] border-2 border-[#1A1A1A] rounded-lg flex items-center justify-center text-lg">
                    🔑
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{key.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-mono text-[var(--text-muted)]">
                        {key.prefix}••••••••••••
                      </p>
                      <div className="flex gap-1">
                        {key.permissions.split(",").map(p => (
                          <span key={p} className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-gray-100 border border-[#1A1A1A] rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--text-muted)] hidden md:block">
                    <p>Created {new Date(key.createdAt).toLocaleDateString()}</p>
                    <p>{key.isActive ? "🟢 Active" : "🔴 Revoked"}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="brutalist-btn brutalist-btn-danger brutalist-btn-sm"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="brutalist-card-static p-12 text-center">
              <div className="text-5xl mb-4">🔑</div>
              <h3 className="text-xl font-bold mb-2">No API keys yet</h3>
              <p className="text-[var(--text-muted)] mb-6">Generate a key to start using the API</p>
              <button onClick={() => setShowCreate(true)} className="brutalist-btn brutalist-btn-primary">
                Generate Your First Key
              </button>
            </div>
          )}
        </>
      ) : (
        /* Integration Docs */
        <div className="space-y-6">
          <div className="brutalist-card-static p-6">
            <h3 className="text-lg font-bold mb-3">🔗 API Base URL</h3>
            <code className="block bg-[var(--bg-secondary)] px-4 py-2 rounded font-mono text-sm border-2 border-[#1A1A1A]">
              {baseUrl}/api
            </code>
          </div>

          <div className="brutalist-card-static p-6">
            <h3 className="text-lg font-bold mb-3">📡 Authentication</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Include your API key in the Authorization header:
            </p>
            <div className="code-block">
              <pre>{`X-API-Key: YOUR_API_KEY`}</pre>
            </div>
          </div>

          <div className="brutalist-card-static p-6">
            <h3 className="text-lg font-bold mb-4">📚 Endpoint Reference</h3>
            <div className="space-y-4">
              {[
                { method: "GET", path: "/api/buckets", desc: "List all buckets", color: "var(--accent-mint)" },
                { method: "POST", path: "/api/buckets", desc: "Create a new bucket", color: "var(--accent-coral)" },
                { method: "DELETE", path: "/api/buckets/:id", desc: "Delete a bucket", color: "#FF4444" },
                { method: "GET", path: "/api/buckets/:id/files?path=/", desc: "List files in a directory", color: "var(--accent-mint)" },
                { method: "POST", path: "/api/buckets/:id/files", desc: "Upload a file (multipart)", color: "var(--accent-coral)" },
                { method: "POST", path: "/api/buckets/:id/files", desc: "Create a folder (JSON body)", color: "var(--accent-coral)" },
                { method: "DELETE", path: "/api/buckets/:id/files?path=...", desc: "Delete a file or folder", color: "#FF4444" },
              ].map((ep, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span
                    className="brutalist-badge text-[10px] w-16 justify-center"
                    style={{ background: ep.color, color: ep.method === "GET" ? "#1A1A1A" : "white" }}
                  >
                    {ep.method}
                  </span>
                  <code className="font-mono text-xs flex-1">{ep.path}</code>
                  <span className="text-[var(--text-muted)] hidden md:block">{ep.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code Snippets */}
          <div className="brutalist-card-static p-6">
            <h3 className="text-lg font-bold mb-4">💻 Code Snippets</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">cURL — List buckets</p>
                <div className="code-block">
                  <pre>{`curl -H "X-API-Key: YOUR_API_KEY" \\
  ${baseUrl}/api/buckets`}</pre>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Python — Upload a file</p>
                <div className="code-block">
                  <pre>{`import requests

API_KEY = "pk_your_key_here"
BUCKET_ID = "your-bucket-id"

with open("photo.jpg", "rb") as f:
    response = requests.post(
        f"${baseUrl}/api/buckets/{BUCKET_ID}/files",
        headers={"X-API-Key": API_KEY},
        files={"file": f},
        data={"path": "/images/"}
    )
    print(response.json())`}</pre>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Node.js — Create a bucket</p>
                <div className="code-block">
                  <pre>{`const response = await fetch(
  "${baseUrl}/api/buckets",
  {
    method: "POST",
    headers: {
      "X-API-Key": "YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "my-new-bucket",
      region: "us-east-1"
    })
  }
);
const bucket = await response.json();
console.log(bucket);`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Generate API Key</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="brutalist-input"
                  placeholder="e.g. My Backend App"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Permissions</label>
                <div className="flex flex-col gap-2 p-3 bg-gray-50 border-2 border-[#1A1A1A] rounded">
                  {Object.entries(permissions).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                        className="w-4 h-4 border-2 border-[#1A1A1A] rounded bg-white checked:bg-[var(--accent-coral)]"
                      />
                      <span className="text-sm font-bold capitalize">{key}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {key === 'read' && "Ability to list and download files"}
                        {key === 'write' && "Ability to upload and create folders"}
                        {key === 'delete' && "Ability to remove buckets and files"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="brutalist-btn brutalist-btn-primary flex-1">
                  {creating ? "Generating..." : "Generate Key"}
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
    </div>
  );
}
