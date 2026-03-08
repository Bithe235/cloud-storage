"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useApi } from "@/lib/useApi";
import { useEffect, useState } from "react";
import { formatBytes } from "@/utils/format";

import Link from "next/link";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  planId: string;
  bucketsCount: number;
  keysCount: number;
  storageUsed: number;
  createdAt: string;
}

export default function UsersPage() {
  const { apiFetch } = useApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const data = await apiFetch("/api/admin/users");
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleBan = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to ${user.isBanned ? 'unban' : 'ban'} ${user.email}?`)) return;
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isBanned: !user.isBanned }),
      });
      fetchUsers();
    } catch (err) {
      alert("Action failed: " + err);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black uppercase tracking-tighter">User Management</h1>
        <div className="brutalist-badge bg-green-300">Total Users: {users.length}</div>
      </div>

      {loading ? (
        <div className="animate-pulse">Loading core system data...</div>
      ) : (
        <div className="overflow-x-auto brutalist-card p-0">
          <table className="brutalist-table w-full">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Usage</th>
                <th>Resources</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <span className={`brutalist-badge ${u.isBanned ? 'bg-red-400' : 'bg-green-400'}`}>
                      {u.isBanned ? 'RESTRICTED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td>{u.role.toUpperCase()}</td>
                  <td>{u.planId}</td>
                  <td>{formatBytes(u.storageUsed)}</td>
                  <td>
                    <div className="flex gap-2">
                    <span title="Buckets">🪣 {u.bucketsCount}</span>
                    <span title="API Keys">🔑 {u.keysCount}</span>
                    </div>
                  </td>
                  <td className="text-xs opacity-60 font-mono">{u.createdAt}</td>
                  <td className="flex gap-2 p-3">
                    <Link
                      href={`/admin/users/${u.id}/buckets`}
                      className="brutalist-btn text-xs py-1 px-3 bg-yellow-300 hover:bg-yellow-400"
                    >
                      EXPLORE
                    </Link>
                    <button 
                      onClick={() => toggleBan(u)}
                      className={`brutalist-btn text-xs py-1 px-3 ${u.isBanned ? 'bg-blue-400' : 'bg-orange-400'}`}
                    >
                      {u.isBanned ? 'UNRESTRICT' : 'BAN USER'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
