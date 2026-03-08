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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Download state machine: per-file tracking
  const [downloadStates, setDownloadStates] = useState<Record<string, { status: "preparing" | "downloading" | "done" | "error"; progress: number }>>({});
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadFiles = useCallback(async (path: string, search?: string) => {
    try {
      const cleanPath = path === "/" ? "" : path.replace(/^\/+|\/+$/g, "");
      const query = search
        ? `?search=${encodeURIComponent(search)}`
        : `?path=${encodeURIComponent(cleanPath)}`;
      const data = await apiFetch(`/api/buckets/${bucketId}/files${query}`);
      const rawFiles = Array.isArray(data) ? data : (data.files || []);
      const mappedFiles = rawFiles.map((f: any) => ({
        ...f,
        id: f.id || f.path || Math.random().toString(),
        isFolder: typeof f.is_file === "boolean" ? !f.is_file : !!f.isFolder,
        createdAt: f.createdAt || new Date().toISOString(),
      }));
      setFiles(mappedFiles);
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
    setUploadProgress(0);
    try {
      const uploadPath = currentPath === "/" ? "" : currentPath.replace(/^\/+|\/+$/g, "");
      const token = localStorage.getItem("token") || "";

      for (const file of Array.from(fileList)) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `http://localhost:8080/api/buckets/${bucketId}/files`);
          if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
          };

          xhr.onerror = () => reject(new Error("XHR Error"));

          const formData = new FormData();
          formData.append("file", file);
          formData.append("path", uploadPath);
          xhr.send(formData);
        });
      }
      showToast(`Uploaded ${fileList.length} file(s) successfully!`);
      loadFiles(currentPath);
    } catch (e) {
      console.error(e);
      showToast("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const folderPath = currentPath === "/" ? "" : currentPath.replace(/^\/+|\/+$/g, "");
      await apiFetch(`/api/buckets/${bucketId}/files`, {
        method: "POST",
        body: JSON.stringify({ path: folderPath, folderName }),
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
      // Rust paths don't start with '/', strip any leading slash
      const cleanFilePath = filePath.replace(/^\/+/, "");
      await apiFetch(`/api/buckets/${bucketId}/files?path=${encodeURIComponent(cleanFilePath)}`, {
        method: "DELETE",
      });
      showToast(`"${name}" deleted`);
      loadFiles(currentPath);
    } catch (e) {
      console.error(e);
    }
  };

  const getDownloadUrl = (filePath: string) => {
    const cleanPath = filePath.replace(/^\/+/, "");
    const token = localStorage.getItem("token") || "";
    return `http://localhost:8080/api/buckets/${bucketId}/download?path=${encodeURIComponent(cleanPath)}&token=${encodeURIComponent(token)}`;
  };

  const renderDownloadButton = (file: FileItem) => {
    return (
      <a
        href={getDownloadUrl(file.path)}
        download={file.name}
        className="mt-2 text-xs brutalist-btn brutalist-btn-primary brutalist-btn-sm w-full block text-center"
      >
        ⬇️ Download
      </a>
    );
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
        className={`drop-zone mb-4 flex flex-col items-center justify-center ${dragOver ? "drag-over" : ""} ${uploading ? "opacity-80" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
        }}
      >
        <div className="text-4xl mb-2">{uploading ? "⏳" : "📤"}</div>
        <p className="font-semibold text-sm">
          {uploading ? "Uploading file..." : "Drag & drop files here to upload"}
        </p>
        
        {uploading && uploadProgress !== null && (
          <div className="w-full max-w-sm mt-4 bg-[var(--surface-color)] border-2 border-[var(--border-color)] h-6 rounded-md overflow-hidden brutalist-shadow-sm">
            <div 
              className="bg-[var(--accent-coral)] h-full flex items-center justify-center text-xs font-bold text-white transition-all duration-200 ease-out"
              style={{ width: `${uploadProgress}%` }}
            >
              {uploadProgress}%
            </div>
          </div>
        )}
        
        {!uploading && <p className="text-xs text-[var(--text-muted)] mt-1">or use the Upload button above</p>}
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
                  {renderDownloadButton(file)}
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
                  <td className="p-3 flex items-center gap-2">
                    {!file.isFolder && (
                      <a
                        href={getDownloadUrl(file.path)}
                        download={file.name}
                        className="text-blue-500 hover:text-blue-700 text-sm font-bold flex items-center justify-center p-1"
                        title="Download"
                      >
                        ⬇
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(file.path, file.name)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold p-1"
                      title="Delete"
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
