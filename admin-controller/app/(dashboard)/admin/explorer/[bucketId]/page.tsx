"use client";

import { useApi } from "@/lib/useApi";
import { useEffect, useState, use } from "react";
import { formatBytes } from "@/utils/format";
import Link from "next/link";

interface FileItem {
  id: string;
  name: string;
  size: number;
  isFolder: boolean;
  mimeType: string;
  path: string;
}

export default function AdminFileExplorer({ params }: { params: Promise<{ bucketId: string }> }) {
  const { bucketId } = use(params);
  const { apiFetch } = useApi();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/buckets/${bucketId}/files?path=${encodeURIComponent(path)}`);
      setFiles(data);
      setCurrentPath(path);
    } catch (err) {
      alert("Failed to access repository: " + err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles("");
  }, [bucketId]);

  return (
    <div className="p-8">
      <div className="flex gap-4 items-center mb-8">
         <Link href="/admin/buckets" className="brutalist-btn bg-white text-xs">← EXIT EXPLORER</Link>
         <h1 className="text-3xl font-black uppercase underline decoration-red-500">Atomic Explorer</h1>
      </div>

      <div className="brutalist-card bg-zinc-900 text-green-400 font-mono text-sm mb-6 flex justify-between items-center">
        <span>ROOT/REPOSITORY/{bucketId}/{currentPath || "/"}</span>
        <button className="text-xs border border-green-400 px-2 py-1">READ-ONLY MODE</button>
      </div>

      {loading ? (
        <div className="animate-pulse text-zinc-500 font-black">SCANNING SECTORS...</div>
      ) : (
        <div className="brutalist-card p-0 overflow-hidden border-zinc-800">
          <table className="brutalist-table w-full">
            <thead className="bg-zinc-800 text-white border-b-2 border-black">
              <tr>
                <th className="!bg-zinc-800">Object Name</th>
                <th className="!bg-zinc-800">Type</th>
                <th className="!bg-zinc-800 text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {currentPath && (
                <tr className="hover:bg-zinc-100 cursor-pointer" onClick={() => loadFiles("")}>
                   <td className="text-blue-600">.. [Go Back]</td>
                   <td colSpan={2}></td>
                </tr>
              )}
              {files.map((f) => (
                <tr 
                  key={f.id} 
                  className={`hover:bg-zinc-100 ${f.isFolder ? 'cursor-pointer text-blue-700' : ''}`}
                  onClick={() => f.isFolder && loadFiles(f.path)}
                >
                  <td className="font-bold">
                    {f.isFolder ? "📁 " : "📄 "}
                    {f.name}
                  </td>
                  <td className="text-xs uppercase opacity-80">{f.isFolder ? 'Directory' : f.mimeType}</td>
                  <td className="text-right font-mono">{f.isFolder ? '--' : formatBytes(f.size)}</td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10 opacity-30 italic font-black">THIS REPOSITORY SEGMENT IS EMPTY</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
