"use client";

import { useEffect, useState } from "react";
import type { AdminIntegration } from "../hooks/useAdminIntegrations";
import { useUpdateAppSetting } from "../hooks/useAdminIntegrations";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-setting-keys";
import { relativeTime } from "../lib/relative-time";

export default function DropboxSignCard({ integration }: { integration: AdminIntegration }) {
  const testMode = integration.status === "test";
  const [confirmingLive, setConfirmingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateAppSetting();

  useEffect(() => { setConfirmingLive(false); }, [integration.status]);

  function setMode(value: boolean) {
    setError(null);
    setConfirmingLive(false);
    mutation.mutate(
      { key: DROPBOX_SIGN_TEST_MODE_KEY, value },
      { onError: () => setError("Failed to update — try again.") },
    );
  }

  function handleToggle() {
    if (mutation.isPending) return;
    if (testMode) {
      setConfirmingLive(true); // Test → Live needs a confirm
    } else {
      setMode(true); // Live → Test flips instantly (turning safety on has no friction)
    }
  }

  const meta: string[] = [];
  if (integration.modeChangedAt) {
    const by = integration.modeChangedByName ? ` by ${integration.modeChangedByName}` : "";
    meta.push(`Mode changed ${relativeTime(integration.modeChangedAt)}${by}`);
  }
  if (integration.lastSyncAt) meta.push(`Last send: ${relativeTime(integration.lastSyncAt)}`);

  return (
    <div className="bg-white rounded-xl border border-[#E2DEEC] p-5">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[#403770] whitespace-nowrap">{integration.name}</span>
        {testMode ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-[#fffaf1] text-[#997c43] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFCF70]" />
            Test Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-[#EDFFE3] text-[#5f665b] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5f665b]" />
            Live
          </span>
        )}
      </div>

      <p className="text-sm text-[#8A80A8] mt-1">{integration.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          role="switch"
          aria-checked={testMode}
          aria-label="Test Mode"
          disabled={mutation.isPending}
          onClick={handleToggle}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#403770]/40 focus:ring-offset-1 ${testMode ? "bg-[#FFCF70]" : "bg-[#C2BBD4]"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${testMode ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-[#544A78] whitespace-nowrap">Test Mode</span>
        <span className="text-xs text-[#A69DC0] whitespace-nowrap">Sends are sandboxed — no real emails, no credits.</span>
      </div>

      {confirmingLive && (
        <div className="mt-3 rounded-lg border border-[#ffd98d] bg-[#fffaf1] p-3">
          <p className="text-sm text-[#997c43]">
            Going live: future sends create real signature requests, email real recipients, and consume Dropbox Sign credits.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode(false)}
              className="rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap">Go live</button>
            <button type="button" onClick={() => setConfirmingLive(false)}
              className="rounded-lg border border-[#C2BBD4] px-3 py-1 text-sm whitespace-nowrap">Cancel</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-[#c25a52]">{error}</p>}

      {meta.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {meta.map((m) => (
            <span key={m} className="text-xs text-[#A69DC0] whitespace-nowrap">{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}
