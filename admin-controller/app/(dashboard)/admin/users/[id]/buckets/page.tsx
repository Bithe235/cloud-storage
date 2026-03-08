"use client";

import { useApi } from "@/lib/useApi";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { formatBytes } from "@/utils/format";

interface Bucket {
  id: string;
  name: string;
  pentaractId: string;
  createdAt: string;
  filesCount?: number;
  totalSize?: number;
}

export default function UserBucketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const { apiFetch } = useApi();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBuckets() {
      try {
        const data = await apiFetch(`/api/admin/users/${userId}/buckets`);
        setBuckets(data || []);
      } catch (err) {
        alert("Failed to access storage units: " + err);
      } finally {
        setLoading(false);
      }
    }
    fetchBuckets();
  }, [userId, apiFetch]);

  return (
    <div className="p-8">
       <div className="flex gap-4 items-center mb-8">
         <Link href="/admin/users" className="brutalist-btn bg-white text-xs">← BACK TO USERS</Link>
         <h1 className="text-3xl font-black uppercase tracking-tighter italic decoration-red-500 underline">USER REPOSITORIES</h1>
      </div>

      {loading ? (
        <div className="animate-pulse font-black text-xl italic uppercase">SCANNING CLUSTER NODES...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buckets.map((b) => (
             <div key={b.id} className="brutalist-card bg-white border-8 border-black shadow-none hover:translate-x-1 hover:translate-y-1">
                <div className="mb-4 pb-2 border-b-4 border-black flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-50">Storage Unit ID</p>
                        <p className="font-black text-xs font-mono">{b.id}</p>
                    </div>
                </div>
                
                <h2 className="text-2xl font-black uppercase mb-4 break-all bg-yellow-200 p-2 border-2 border-black inline-block">{b.name}</h2>

                <div className="space-y-2 mb-6">
                    <p className="text-xs font-bold">CREATED: <span className="opacity-60">{new Date(b.createdAt).toLocaleDateString()}</span></p>
                    <p className="text-xs font-bold">SERVICE: <span className="text-blue-600">CLOUD CORE R2</span></p>
                </div>

                <Link 
                  href={`/admin/explorer/${b.id}`}
                  className="w-full brutalist-btn bg-black text-white text-center justify-center py-3 text-lg font-black hover:bg-zinc-800"
                >
                   DEEP EXPLORATION
                </Link>
             </div>
          ))}
          {buckets.length === 0 && (
             <div className="col-span-full border-8 border-dashed border-black p-20 text-center bg-gray-100">
                <p className="text-4xl font-black opacity-20 uppercase">NO REPOSITORIES INITIALIZED</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
