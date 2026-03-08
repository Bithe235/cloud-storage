"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/admin/users");
  }, [router]);

  return (
    <div className="min-h-screen bg-yellow-200 grid place-items-center">
      <div className="animate-bounce font-black text-4xl uppercase italic">INITIALIZING ADMIN CONTROLLER...</div>
    </div>
  );
}
