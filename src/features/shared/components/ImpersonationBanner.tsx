"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ImpersonationState {
  active: boolean;
  userName: string | null;
  userEmail: string | null;
}

export default function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState>({ active: false, userName: null, userEmail: null });
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/impersonate/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.active) {
          setState({ active: true, userName: data.userName, userEmail: data.userEmail });
        }
      })
      .catch(() => {});
  }, []);

  if (!state.active) return null;

  const handleExit = async () => {
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: null }),
    });
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#E8735A] text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <span>
        Viewing as <strong>{state.userName || state.userEmail}</strong>
        {state.userName && state.userEmail && (
          <span className="opacity-80 ml-1">({state.userEmail})</span>
        )}
      </span>
      <button
        onClick={handleExit}
        className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
      >
        Exit
      </button>
    </div>
  );
}
