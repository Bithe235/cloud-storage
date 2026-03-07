"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useApi } from "@/lib/useApi";
import Link from "next/link";

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  isFolder: boolean;
  createdAt: string;
}

interface BucketInfo {
  id: string;
  name: string;
  region: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(name: string, isFolder: boolean): string {
  if (isFolder) return "📁";
  const ext = name.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    pdf: "📕", doc: "📘", docx: "📘", txt: "📄", md: "📝",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", svg: "🎨", webp: "🖼️",
    mp4: "🎬", avi: "🎬", mov: "🎬", mp3: "🎵", wav: "🎵",
    zip: "📦", rar: "📦", tar: "📦", gz: "📦",
    js: "⚡", ts: "💎", py: "🐍", rs: "🦀", html: "🌐", css: "🎨",
    json: "📋", xml: "📋", csv: "📊", xlsx: "📊",
  };
  return icons[ext || ""] || "📄";
}

export default function BucketFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bucketId } = use(params);
  const { apiFetch } = useApi();
  const [bucket, setBucket] = useState<BucketInfo | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [loading, setLoading] = useState(true);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadFiles = useCallback(async (path: string, search?: string) => {
    try {
      const query = search
        ? `?search=${encodeURIComponent(search)}`
        : `?path=${encodeURIComponent(path)}`;
      const data = await apiFetch(`/api/buckets/${bucketId}/files${query}`);
      setFiles(data.files || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, bucketId]);

  useEffect(() => {
    async function loadBucket() {
      try {
        const b = await apiFetch(`/api/buckets/${bucketId}`);
        setBucket(b);
      } catch (e) {
        console.error(e);
      }
    }
    loadBucket();
    loadFiles("/");
  }, [apiFetch, bucketId, loadFiles]);

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
    setSearchQuery("");
    setLoading(true);
    loadFiles(path);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setLoading(true);
      loadFiles(currentPath, searchQuery);
    } else {
      setLoading(true);
      loadFiles(currentPath);
    }
  };

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", currentPath);
        await apiFetch(`/api/buckets/${bucketId}/files`, {
          method: "POST",
          body: formData,
        });
      }
      showToast(`Uploaded ${fileList.length} file(s) successfully!`);
      loadFiles(currentPath);
    } catch (e) {
      console.error(e);
      showToast("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/buckets/${bucketId}/files`, {
        method: "POST",
        body: JSON.stringify({ path: currentPath, folderName }),
      });
      setShowCreateFolder(false);
      setFolderName("");
      showToast("Folder created!");
      loadFiles(currentPath);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await apiFetch(`/api/buckets/${bucketId}/files?path=${encodeURIComponent(filePath)}`, {
        method: "DELETE",
      });
      showToast(`"${name}" deleted`);
      loadFiles(currentPath);
    } catch (e) {
      console.error(e);
    }
  };

  // breadcrumb parts
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/buckets" className="brutalist-btn brutalist-btn-secondary brutalist-btn-sm">
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🪣 {bucket?.name || "Loading..."}
          </h1>
          {bucket && <p className="text-xs text-[var(--text-muted)]">{bucket.region}</p>}
        </div>
      </div>

      {/* Toolbar */}
      <div className="brutalist-card-static p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 flex-1 min-w-0 text-sm">
            <button
              onClick={() => navigateToPath("/")}
              className="font-semibold hover:text-[var(--accent-coral)] transition-colors"
            >
              🏠 Root
            </button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">/</span>
                <button
                  onClick={() => navigateToPath("/" + pathParts.slice(0, i + 1).join("/") + "/")}
                  className="font-medium hover:text-[var(--accent-coral)] transition-colors truncate max-w-32"
                >
                  {part}
                </button>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="brutalist-input w-48"
              placeholder="Search files..."
            />
          </div>

          {/* Actions */}
          <button onClick={() => setShowCreateFolder(true)} className="brutalist-btn brutalist-btn-mint brutalist-btn-sm">
            📁 New Folder
          </button>
          <label className="brutalist-btn brutalist-btn-primary brutalist-btn-sm cursor-pointer">
            ⬆️ Upload
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
          <button
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="brutalist-btn brutalist-btn-secondary brutalist-btn-sm"
          >
            {viewMode === "grid" ? "☰" : "⊞"}
          </button>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone mb-4 ${dragOver ? "drag-over" : ""} ${uploading ? "opacity-50" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
        }}
      >
        <div className="text-3xl mb-2">{uploading ? "⏳" : "📤"}</div>
        <p className="font-semibold text-sm">
          {uploading ? "Uploading..." : "Drag & drop files here to upload"}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">or use the Upload button above</p>
      </div>

      {/* File Listing */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-[var(--text-muted)] font-medium">Loading files...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="brutalist-card-static p-10 text-center">
          <div className="text-4xl mb-3">📂</div>
          <h3 className="font-bold text-lg mb-1">This folder is empty</h3>
          <p className="text-sm text-[var(--text-muted)]">Upload files or create a subfolder</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="brutalist-card p-4 relative group"
            >
              {file.isFolder ? (
                <button
                  onClick={() => navigateToPath(file.path)}
                  className="block w-full text-left"
                >
                  <div className="text-3xl mb-2">{getFileIcon(file.name, true)}</div>
                  <p className="font-semibold text-sm truncate">{file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Folder</p>
                </button>
              ) : (
                <div>
                  <div className="text-3xl mb-2">{getFileIcon(file.name, false)}</div>
                  <p className="font-semibold text-sm truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{formatBytes(file.size)}</p>
                </div>
              )}
              <button
                onClick={() => handleDelete(file.path, file.name)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="brutalist-card-static overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b-[3px] border-[#1A1A1A] bg-[var(--bg-secondary)]">
                <th className="text-left p-3 text-sm font-semibold">Name</th>
                <th className="text-left p-3 text-sm font-semibold w-24">Size</th>
                <th className="text-left p-3 text-sm font-semibold w-32">Modified</th>
                <th className="w-16 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-gray-100 hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="p-3">
                    {file.isFolder ? (
                      <button
                        onClick={() => navigateToPath(file.path)}
                        className="flex items-center gap-2 hover:text-[var(--accent-coral)]"
                      >
                        <span>{getFileIcon(file.name, true)}</span>
                        <span className="font-medium text-sm">{file.name}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{getFileIcon(file.name, false)}</span>
                        <span className="text-sm">{file.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-[var(--text-muted)]">
                    {file.isFolder ? "—" : formatBytes(file.size)}
                  </td>
                  <td className="p-3 text-xs text-[var(--text-muted)]">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(file.path, file.name)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="modal-overlay" onClick={() => setShowCreateFolder(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Create New Folder</h2>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Folder Name</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="brutalist-input"
                  placeholder="my-folder"
                  required
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Created in: {currentPath}
                </p>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="brutalist-btn brutalist-btn-mint flex-1">
                  Create Folder
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateFolder(false)}
                  className="brutalist-btn brutalist-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast">
          <div className="brutalist-card-static p-4 flex items-center gap-3">
            <span className="text-lg">✅</span>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
