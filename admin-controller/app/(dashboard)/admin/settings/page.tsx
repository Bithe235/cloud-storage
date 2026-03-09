"use client";

import { useApi } from "@/lib/useApi";
import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const { apiFetch, baseUrl } = useApi();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await apiFetch("/api/admin/maintenance");
        setMaintenanceMode(data.maintenanceMode);
        setReason(data.maintenanceReason);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [apiFetch]);

  const handleToggleMaintenance = async () => {
    setSaving(true);
    try {
      const data = await apiFetch("/api/admin/maintenance", {
        method: "POST",
        body: JSON.stringify({
          enabled: !maintenanceMode,
          reason: reason
        }),
      });
      setMaintenanceMode(data.maintenanceMode);
      setReason(data.maintenanceReason);
      alert(`SYSTEM ${data.maintenanceMode ? 'LOCKED' : 'RELEASED'} SUCCESSFULLY.`);
    } catch (err) {
      alert("Failed to toggle maintenance: " + err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-10 italic underline decoration-red-500">Bridge Configuration CORE</h1>

      {loading ? (
        <div className="animate-pulse">Accessing hardware state...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* Maintenance Mode Controller */}
          <div className={`brutalist-card ${maintenanceMode ? 'bg-red-50 border-red-600' : 'bg-green-50 border-green-600'}`}>
            <div className="flex justify-between items-start mb-6">
               <h2 className="text-2xl font-black uppercase italic">Maintenance Master</h2>
               <div className={`brutalist-badge ${maintenanceMode ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                  {maintenanceMode ? 'STATE: LOCKED' : 'STATE: OPERATIONAL'}
               </div>
            </div>

            <p className="text-sm font-bold mb-6 opacity-70">
              Activating maintenance mode will block all non-administrative users from accessing storage, buckets, and API keys. Use this for critical system patches.
            </p>

            <div className="space-y-4">
               <div>
                  <label className="text-xs font-black uppercase block mb-1">Public Downtime Reason</label>
                  <textarea 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="brutalist-input h-24 text-sm font-bold"
                    placeholder="Describe why the system is down..."
                  />
               </div>

               <button 
                 onClick={handleToggleMaintenance}
                 disabled={saving}
                 className={`w-full brutalist-btn text-white font-black py-4 text-xl ${
                    maintenanceMode ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                 }`}
               >
                 {saving ? 'COMMUNICATING...' : maintenanceMode ? 'TERMINATE MAINTENANCE MODE' : 'INITIALIZE SYSTEM MAINTENANCE'}
               </button>
            </div>
          </div>

          {/* System Info */}
          <div className="brutalist-card bg-white">
             <h2 className="text-2xl font-black uppercase mb-6 border-b-4 border-black pb-2">Hardware & Cluster Info</h2>
             <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between border-b border-dashed border-black pb-2">
                   <span className="opacity-50">API ENDPOINT:</span>
                   <span className="font-bold">{baseUrl}/api</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-black pb-2">
                   <span className="opacity-50">MASTER TOKEN:</span>
                   <span className="font-bold">AES-256 ENCRYPTED</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-black pb-2">
                   <span className="opacity-50">NODE STATUS:</span>
                   <span className="text-green-600 font-bold">HEALTHY [8/8]</span>
                </div>
                <div className="flex justify-between">
                   <span className="opacity-50">RUST ENGINE:</span>
                   <span className="font-bold">v2.4.1-STABLE</span>
                </div>
             </div>
             
             <div className="mt-8 p-4 bg-zinc-900 text-green-400 text-[10px] font-mono rounded ring-4 ring-zinc-700">
                &gt; PENTARACT_BRIDGE_LOG --TAIL 5<br/>
                [*] SYS::HEARTBEAT_ACK 127.0.0.1<br/>
                [*] AUTH::VERIFY_RSA_OK master@pentaract<br/>
                [*] CLOUD::R2_CONN_POOL_READY<br/>
                [*] BRIDGE::MAINTENANCE_IDLE_THREAD_ACTIVE<br/>
                [*] MONITOR::LATENCY_9ms
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
