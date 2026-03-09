"use client";

import { useApi } from "@/lib/useApi";
import { useAuth } from "@/app/context/AuthContext";
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
  const { token } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadFiles = async (path: string, search?: string) => {
    setLoading(true);
    try {
      const q = search 
        ? `search=${encodeURIComponent(search)}` 
        : `path=${encodeURIComponent(path)}`;
      const data = await apiFetch(`/api/buckets/${bucketId}/files?${q}`);
      setFiles(data || []);
      if (!search) {
        setCurrentPath(path);
        setSearchQuery("");
      }
    } catch (err) {
      alert("Failed to access repository: " + err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      loadFiles(currentPath, searchQuery);
    } else {
      loadFiles(currentPath);
    }
  };

  useEffect(() => {
    loadFiles("");
  }, [bucketId]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex gap-4 items-center">
           <Link href="/admin/buckets" className="brutalist-btn bg-white text-xs">← EXIT EXPLORER</Link>
           <h1 className="text-3xl font-black uppercase underline decoration-red-500">Atomic Explorer</h1>
        </div>
        <div className="bg-black text-white px-4 py-2 font-mono text-[10px] border-2 border-black">
          STATUS: CLUSTER_ADMIN_LINK // STANDBY
        </div>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
         <button 
           onClick={() => loadFiles("")}
           className="px-3 py-1 bg-zinc-200 border-2 border-black font-black text-xs hover:bg-zinc-300"
         >
           ROOT
         </button>
         {currentPath.split("/").filter(p => p).map((part, i, arr) => (
           <div key={i} className="flex gap-1 items-center">
             <span className="font-black">/</span>
             <button 
               onClick={() => loadFiles(arr.slice(0, i + 1).join("/"))}
               className="px-3 py-1 bg-zinc-200 border-2 border-black font-black text-xs hover:bg-zinc-300"
             >
               {part}
             </button>
           </div>
         ))}
      </div>

      <div className="brutalist-card bg-zinc-900 text-green-400 font-mono text-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <span>BUCKET_ID: {bucketId}</span>
        
        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2">
          <input 
            type="text"
            placeholder="Search atoms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black border border-green-400 text-green-400 px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-green-400 w-full md:w-64"
          />
          <button 
            type="submit"
            className="border border-green-400 px-3 py-1 text-xs uppercase hover:bg-green-400 hover:text-black transition-colors"
          >
            Search
          </button>
        </form>

        <button className="text-[10px] border border-green-400 px-2 py-0.5 uppercase hidden md:block">Admin Access Mode</button>
      </div>

      {loading ? (
        <div className="animate-pulse text-zinc-500 font-black flex items-center gap-2">
          <div className="w-4 h-4 bg-zinc-500 animate-spin"></div>
          SYNCING ENGINE SECTORS...
        </div>
      ) : (
        <div className="brutalist-card p-0 overflow-hidden border-zinc-800">
          <table className="brutalist-table w-full">
            <thead className="bg-zinc-800 text-white border-b-2 border-black">
              <tr>
                <th className="!bg-zinc-800 text-left">Object Name</th>
                <th className="!bg-zinc-800 text-left">Type</th>
                <th className="!bg-zinc-800 text-right">Size</th>
                <th className="!bg-zinc-800 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr 
                  key={f.id} 
                  className={`hover:bg-zinc-50 transition-colors ${f.isFolder ? 'text-blue-700' : ''}`}
                >
                  <td className="font-bold py-3 pr-4">
                    <span 
                      className={f.isFolder ? "cursor-pointer hover:underline" : ""}
                      onClick={() => f.isFolder && loadFiles(f.path)}
                    >
                      {f.isFolder ? "📁 " : "📄 "}
                      {f.name}
                    </span>
                  </td>
                  <td className="text-[10px] uppercase font-black opacity-60">{f.isFolder ? 'Directory' : f.mimeType || 'Data Object'}</td>
                  <td className="text-right font-mono font-bold">{f.isFolder ? '--' : formatBytes(f.size)}</td>
                  <td className="text-center">
                    {!f.isFolder && (
                      <a 
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'https://server.fahadakash.com/penta'}/api/buckets/${bucketId}/download?path=${encodeURIComponent(f.path)}&token=${encodeURIComponent(token || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-black uppercase underline hover:text-red-500"
                      >
                        Extract
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-20 opacity-30 italic font-black text-xl">
                    THIS REPOSITORY SEGMENT IS EMPTY
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
