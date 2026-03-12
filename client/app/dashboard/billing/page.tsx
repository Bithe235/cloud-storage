"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { formatBytes } from "@/utils/format";
import { useAuth } from "../../context/AuthContext";

interface Plan {
  id: string;
  name: string;
  priceBDT: number;
  limit: number;
  maxFileSize: number;
}

interface BillingInfo {
  planId: string;
  limit: number;
  used: number;
  plans: Plan[];
  expiresAt: string;
  isExpired: boolean;
  daysLeft: number;
}

export default function BillingPage() {
  const { apiFetch } = useApi();
  const { refreshUser } = useAuth();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadBillingInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch("/api/billing");
      setBilling(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load billing info");
      showToast("Failed to load billing info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingInfo();
  }, []);

  const getProratedCredit = (plan: Plan): { creditedDays: number; label: string } | null => {
    if (!billing) return null;
    const currentPlan = billing.plans.find(p => p.id === billing.planId);
    if (!currentPlan || !billing.expiresAt || billing.isExpired) return null;
    if (plan.id === billing.planId) return null;

    const remainingMs = new Date(billing.expiresAt).getTime() - Date.now();
    const remainingDays = remainingMs / (1000 * 60 * 60 * 24);
    if (remainingDays <= 0) return null;

    const isUpgrade = plan.priceBDT > currentPlan.priceBDT && currentPlan.priceBDT > 0 && plan.priceBDT > 0;
    const isDowngrade = plan.priceBDT < currentPlan.priceBDT && plan.priceBDT > 0;

    if (isUpgrade) {
      const creditedDays = Math.floor((remainingDays * currentPlan.priceBDT) / plan.priceBDT);
      return { creditedDays, label: `+${creditedDays} bonus days credit included` };
    }
    if (isDowngrade) {
      return { creditedDays: 0, label: `Takes effect after ${billing.daysLeft} days remaining` };
    }
    return null;
  };

  const handleUpgrade = async (planId: string) => {
    const plan = billing?.plans.find(p => p.id === planId);
    const currentPlan = billing?.plans.find(p => p.id === billing?.planId);
    
    if (!plan || !billing) return;

    // Build a clear confirmation message
    const isDowngrade = plan.priceBDT > 0 && currentPlan && plan.priceBDT < currentPlan.priceBDT && !billing.isExpired;
    const credit = getProratedCredit(plan);
    
    let confirmMsg = `Switch to ${plan.name}?`;
    if (isDowngrade) {
      confirmMsg = `Downgrade to ${plan.name}?\n\nYour current ${currentPlan?.name} will remain active for ${billing.daysLeft} days. The downgrade takes effect when it expires.`;
    } else if (credit && credit.creditedDays > 0) {
      confirmMsg = `Upgrade to ${plan.name}?\n\n✨ You have ${billing.daysLeft} days remaining on your current plan.\nWe'll credit ${credit.creditedDays} bonus days to your new plan.\nYour new plan will last ~${30 + credit.creditedDays} days total.`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    setUpdating(true);
    try {
      const res = await apiFetch("/api/billing/upgrade", {
        method: "POST",
        body: JSON.stringify({ planId })
      });

      if (res.prorationType === "scheduled_downgrade") {
        showToast(`Downgrade scheduled! ${currentPlan?.name} stays active until it expires.`);
      } else if (res.prorationType === "none") {
        showToast("You're already on this plan!");
      } else if (res.creditedDays > 0) {
        showToast(`✨ Plan upgraded! ${res.creditedDays} days credited from your old plan.`);
      } else {
        showToast("Plan updated successfully!");
      }
      await refreshUser();
      await loadBillingInfo();
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Error upgrading plan");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="brutalist-card-static p-8 text-center text-[var(--accent-coral)]">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p className="font-semibold text-gray-800">Loading Billing Info...</p>
        </div>
      </div>
    );
  }

  if (error || !billing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="brutalist-card-static p-8 text-center border-red-500">
          <div className="text-4xl mb-4">❌</div>
          <p className="font-bold text-red-600 mb-4">{error || "Something went wrong"}</p>
          <button onClick={loadBillingInfo} className="brutalist-btn brutalist-btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const usagePercent = billing.limit > 0 ? Math.min(100, (billing.used / billing.limit) * 100) : 100;
  const atLimit = (billing.limit > 0 && billing.used >= billing.limit) || billing.isExpired;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">💳 Billing & Storage</h1>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-[var(--text-color)] text-white px-6 py-3 rounded-md brutalist-shadow z-50 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Usage Analytics */}
      <div className="brutalist-card-static p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Storage Usage</h2>
          {billing.expiresAt && !billing.isExpired && (
            <div className="bg-[var(--accent-mint)] border-2 border-[#1A1A1A] px-3 py-1 text-xs font-black uppercase">
              ⏳ {billing.daysLeft} Days Remaining
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-3xl font-black text-[var(--accent-coral)]">{formatBytes(billing.used)}</span> 
            <span className="text-[var(--text-muted)] font-semibold ml-2">used of {formatBytes(billing.limit)}</span>
          </div>
          <span className="font-bold">{usagePercent.toFixed(1)}%</span>
        </div>

        <div className="w-full bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] h-8 rounded-md overflow-hidden relative">
          <div 
            className={`h-full transition-all duration-500 flex items-center justify-end pr-2 text-xs font-bold text-white ${atLimit ? 'bg-red-500' : 'bg-[var(--accent-coral)]'}`}
            style={{ width: `${Math.max(usagePercent, 1)}%` }}
          />
        </div>

        {billing.isExpired && (
          <div className="mt-4 p-3 border-2 border-red-800 bg-red-100 text-red-900 font-bold rounded flex flex-col gap-1">
            <span className="text-lg">⚠️ PLAN EXPIRED</span>
            <p className="text-sm font-medium">Your plan expired on {new Date(billing.expiresAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}. Your uploads are disabled until you renew or upgrade.</p>
          </div>
        )}

        {atLimit && !billing.isExpired && (
          <div className="mt-4 p-3 border-2 border-[#1A1A1A] bg-red-100 text-red-800 font-bold rounded flex gap-2">
            ⚠️ Storage limit exceeded! You must delete files or upgrade your plan to upload more.
          </div>
        )}

        {!billing.isExpired && billing.expiresAt && (
          <div className="mt-4 p-3 border-2 border-[var(--accent-mint)] bg-green-50 text-green-800 font-bold rounded">
            🗓️ Your plan will renew/expire on: <span className="underline">{new Date(billing.expiresAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        )}
      </div>

      {/* Plans */}
      <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {billing.plans
          .filter((p: Plan) => p.priceBDT === 0) // TODO: Re-enable other plans (p => true) once payment system is ready
          .map((plan: Plan) => {
          const isActive = plan.id === billing.planId;
          const credit = getProratedCredit(plan);
          const currentPlan = billing.plans.find(p => p.id === billing.planId);
          const isDowngrade = !isActive && plan.priceBDT > 0 && currentPlan && plan.priceBDT < currentPlan.priceBDT && !billing.isExpired;
          
          return (
            <div 
              key={plan.id} 
              className={`brutalist-card p-4 flex flex-col ${isActive ? 'ring-4 ring-[var(--accent-coral)] ring-offset-2' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-black leading-tight">{plan.name}</h3>
                {isActive && (
                  <span className="bg-[var(--accent-coral)] text-white text-[10px] font-black uppercase px-2 py-0.5 border-2 border-[#1A1A1A]">
                    ACTIVE
                  </span>
                )}
              </div>
              
              <div className="mb-3">
                <span className="text-2xl font-bold">{plan.priceBDT === 0 ? "FREE" : plan.priceBDT}</span>
                {plan.priceBDT > 0 && <span className="font-semibold text-gray-500 text-xs"> BDT/mo</span>}
              </div>

              {/* Proration badge */}
              {!isActive && credit && (
                <div className={`mb-3 px-2 py-1.5 border-2 text-[10px] font-black uppercase leading-tight ${
                  credit.creditedDays > 0 
                    ? 'bg-green-50 border-green-600 text-green-800' 
                    : 'bg-orange-50 border-orange-500 text-orange-800'
                }`}>
                  {credit.creditedDays > 0 ? '✨' : '⏳'} {credit.label}
                </div>
              )}
              
              <ul className="space-y-1 mb-6 flex-1 text-[11px] font-bold">
                <li className="flex items-center gap-1.5 underline decoration-[var(--accent-coral)]">
                  📁 {formatBytes(plan.limit)} Storage
                </li>
                <li className="flex items-center gap-1.5 text-[var(--text-secondary)]">🗄️ {formatBytes(plan.maxFileSize)} per file</li>
                <li className="flex items-center gap-1.5 text-[var(--text-secondary)]">🛡️ Secure Backup</li>
                <li className="flex items-center gap-1.5 text-[var(--text-secondary)]">⚡ Fast Retrieval</li>
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isActive || updating}
                className={`w-full brutalist-btn brutalist-btn-sm ${isActive ? 'bg-gray-100 border-[#CCC] text-gray-400 cursor-not-allowed' : isDowngrade ? 'bg-orange-100 border-orange-500 text-orange-800' : 'brutalist-btn-primary'}`}
              >
                {isActive ? 'Current Plan' : isDowngrade ? 'Schedule Downgrade' : plan.priceBDT === 0 ? 'Switch to Free' : 'Upgrade →'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
