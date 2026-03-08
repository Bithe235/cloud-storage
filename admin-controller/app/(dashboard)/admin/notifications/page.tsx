"use client";

import { useApi } from "@/lib/useApi";
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  userId: string | null;
  message: string;
  type: string;
  createdAt: string;
}

export default function AdminNotificationsPage() {
  const { apiFetch } = useApi();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [targetUser, setTargetUser] = useState(""); // empty for global

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch("/api/admin/notifications");
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          message,
          type,
          userId: targetUser || null
        }),
      });
      setMessage("");
      fetchNotifications();
      alert("Broadcast successful!");
    } catch (err) {
      alert("Failed to send: " + err);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-10 italic">System Broadcast center</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Create Broadcast */}
        <div className="brutalist-card bg-white">
          <h2 className="text-2xl font-black mb-6 uppercase border-b-4 border-black pb-2">Create New Alert</h2>
          <form onSubmit={handleSend} className="space-y-6">
            <div>
              <label className="text-sm font-black uppercase">Recipient ID (Optional - leave empty for global)</label>
              <input 
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="brutalist-input mt-1"
                placeholder="Target User UUID or empty for ALL"
              />
            </div>
            <div>
              <label className="text-sm font-black uppercase">Message Content</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="brutalist-input mt-1 h-32"
                placeholder="Enter the broadcast message..."
                required
              />
            </div>
            <div>
              <label className="text-sm font-black uppercase block mb-2">Priority Level</label>
              <div className="flex gap-4">
                {['info', 'warning', 'error', 'alert'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`brutalist-btn text-xs uppercase ${type === t ? 'bg-black text-white ring-4 ring-yellow-300' : 'bg-white'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full brutalist-btn bg-blue-500 text-white font-black py-4 hover:bg-blue-600">
               EXECUTE BROADCAST
            </button>
          </form>
        </div>

        {/* History */}
        <div className="space-y-6">
           <h2 className="text-2xl font-black uppercase">Broadcast Log</h2>
           {loading ? (
             <div className="animate-pulse">Accessing transmission logs...</div>
           ) : (
             <div className="space-y-4 h-[600px] overflow-auto pr-4">
                {notifications.map((n) => (
                   <div key={n.id} className={`brutalist-card p-4 borderL-8 ${
                     n.type === 'error' ? 'border-l-red-500' : 
                     n.type === 'warning' ? 'border-l-orange-500' : 
                     'border-l-blue-500'
                   }`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="brutalist-badge text-[10px] bg-zinc-100 italic">{n.type.toUpperCase()}</span>
                        <span className="text-[10px] font-mono opacity-50">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-bold text-sm leading-tight">{n.message}</p>
                      <div className="mt-2 text-[10px] font-black uppercase text-zinc-400">
                         Target: {n.userId || 'GLOBAL BROADCAST'}
                      </div>
                   </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
