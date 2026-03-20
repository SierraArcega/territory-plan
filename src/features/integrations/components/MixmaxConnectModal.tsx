"use client";

import { useState, useEffect, useRef } from "react";
import { useConnectMixmax } from "../lib/queries";

interface MixmaxConnectModalProps {
  onClose: () => void;
}

export default function MixmaxConnectModal({ onClose }: MixmaxConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const connectMutation = useConnectMixmax();

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    try {
      await connectMutation.mutateAsync(apiKey.trim());
      onClose();
    } catch {
      // Error is captured by the mutation state
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: "#FF6B4A" }}
            >
              Mx
            </div>
            <h2 className="text-lg font-semibold text-[#403770]">Connect Mixmax</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6">
            <p className="text-sm text-gray-500 mb-4">
              Enter your Mixmax API key to connect your account. You can find this in your{" "}
              <span className="font-medium text-[#403770]">Mixmax Settings &rarr; API</span>.
            </p>

            <label htmlFor="mixmax-api-key" className="block text-sm font-medium text-[#403770] mb-1.5">
              API Key
            </label>
            <input
              ref={inputRef}
              id="mixmax-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Mixmax API key"
              disabled={connectMutation.isPending}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            />

            {connectMutation.isError && (
              <p className="mt-2 text-sm text-red-600">
                {(connectMutation.error as Error)?.message || "Invalid API key. Please check and try again."}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={connectMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKey.trim() || connectMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {connectMutation.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              )}
              {connectMutation.isPending ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
