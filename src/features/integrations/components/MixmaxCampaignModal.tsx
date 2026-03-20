"use client";

// MixmaxCampaignModal — Modal listing active Mixmax sequences with "Add to sequence" action
// Fetches sequences from the Mixmax API and lets the user enroll a contact

import { useState, useEffect } from "react";
import { useMixmaxCampaigns, useAddToCampaign } from "../lib/queries";

interface MixmaxCampaignModalProps {
  contactEmail: string;
  contactName: string | null;
  onClose: () => void;
}

export default function MixmaxCampaignModal({
  contactEmail,
  contactName,
  onClose,
}: MixmaxCampaignModalProps) {
  const { data, isLoading, isError } = useMixmaxCampaigns();
  const addToCampaign = useAddToCampaign();
  const [addedSequenceId, setAddedSequenceId] = useState<string | null>(null);
  const [errorSequenceId, setErrorSequenceId] = useState<string | null>(null);

  const sequences = data?.sequences || [];

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleAdd = async (sequenceId: string) => {
    setErrorSequenceId(null);
    try {
      await addToCampaign.mutateAsync({ sequenceId, contactEmail });
      setAddedSequenceId(sequenceId);
    } catch {
      setErrorSequenceId(sequenceId);
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
            <div>
              <h2 className="text-lg font-semibold text-[#403770]">Add to Sequence</h2>
              <p className="text-xs text-gray-500">
                {contactName ? `${contactName} (${contactEmail})` : contactEmail}
              </p>
            </div>
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
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-600 text-center py-4">
              Failed to load sequences. Check your Mixmax connection.
            </p>
          )}

          {!isLoading && !isError && sequences.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No active sequences found in your Mixmax account.
            </p>
          )}

          {!isLoading && !isError && sequences.length > 0 && (
            <div className="space-y-2">
              {sequences.map((seq) => {
                const isAdded = addedSequenceId === seq._id;
                const hasError = errorSequenceId === seq._id;
                const isAdding =
                  addToCampaign.isPending &&
                  addToCampaign.variables?.sequenceId === seq._id;

                return (
                  <div
                    key={seq._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {seq.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {seq.numStages} {seq.numStages === 1 ? "stage" : "stages"}
                      </p>
                    </div>

                    <div className="ml-3 shrink-0">
                      {isAdded ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAdd(seq._id)}
                          disabled={isAdding}
                          className="px-2.5 py-1 text-xs font-medium text-[#403770] bg-[#403770]/5 hover:bg-[#403770]/10 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isAdding ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-[#403770] border-t-transparent" />
                              Adding...
                            </>
                          ) : (
                            "Add"
                          )}
                        </button>
                      )}
                      {hasError && (
                        <p className="text-[10px] text-red-500 mt-0.5">Failed</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
