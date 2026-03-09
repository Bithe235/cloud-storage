"use client";

import { useApi } from "@/lib/useApi";
import { useEffect, useState } from "react";
import { formatBytes } from "@/utils/format";
import Link from "next/link";

interface AdminBucket {
  id: string;
  name: string;
  pentaractId: string;
  ownerId: string;
  createdAt: string;
  filesCount: number;
  totalSize: number;
  ownerEmail: string; // If we can get it from the backend
}

export default function AdminBucketsPage() {
  const { apiFetch } = useApi();
  const [buckets, setBuckets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBuckets() {
      try {
        // We'll use a generic search or list all buckets if permitted
        // For now, let's fetch a summary or implement a specific admin/buckets endpoint in backend
        const data = await apiFetch("/api/admin/users"); // Reuse users to get their metrics/buckets
        setBuckets(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBuckets();
  }, [apiFetch]);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-10 italic underline decoration-blue-500">SYSTEM REPOSITORY OBSERVER</h1>
      
      {loading ? (
        <div className="animate-pulse">Accessing system storage logs...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buckets.map((user) => (
             <div key={user.id} className="brutalist-card bg-white">
                <div className="mb-4 pb-2 border-b-4 border-black bg-yellow-100 p-2">
                    <p className="text-xs font-black uppercase">Owner Identity</p>
                    <p className="font-bold truncate text-lg">{user.email}</p>
                </div>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-2 bg-blue-50 border-2 border-black">
                        <span className="font-black text-sm uppercase">Active Buckets</span>
                        <span className="text-2xl font-black">{user.bucketsCount}</span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-green-50 border-2 border-black">
                        <span className="font-black text-sm uppercase">Gross Storage</span>
                        <span className="text-xl font-black">{formatBytes(user.storageUsed)}</span>
                    </div>

                    <div className="pt-4 mt-4 border-t-2 border-dashed border-black">
                         <Link 
                          href={`/admin/users/${user.id}/buckets`}
                          className="w-full brutalist-btn bg-black text-white text-xs py-2 hover:bg-zinc-800 text-center block"
                         >
                            VIEW ALL STORAGE UNITS
                         </Link>
                    </div>
                </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
