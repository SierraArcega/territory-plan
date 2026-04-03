"use client";

import { useState, useCallback } from "react";
import { Plus, Layers, Loader2 } from "lucide-react";
import { useSequences, useCreateSequence, useUpdateSequence } from "../lib/queries";
import SequenceCard from "./SequenceCard";
import SequenceEditor from "./SequenceEditor";

export default function SequencesTab() {
  const { data: sequences, isLoading } = useSequences();
  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();

  const [editingSequenceId, setEditingSequenceId] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleNewSequence = useCallback(async () => {
    try {
      const result = await createSequence.mutateAsync({
        name: "Untitled Sequence",
      });
      setEditingSequenceId(result.id);
      setIsEditorOpen(true);
    } catch {
      // Error handled by TanStack Query
    }
  }, [createSequence]);

  const handleOpenSequence = useCallback((id: number) => {
    setEditingSequenceId(id);
    setIsEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingSequenceId(null);
  }, []);

  const handleArchive = useCallback(
    async (id: number) => {
      await updateSequence.mutateAsync({ id, isArchived: true });
    },
    [updateSequence]
  );

  const handleRun = useCallback((sequenceId: number) => {
    // This will be wired to the ContactSelector in a future task
    console.log("Run sequence:", sequenceId);
  }, []);

  // Show editor when editing
  if (isEditorOpen) {
    return (
      <SequenceEditor
        sequenceId={editingSequenceId}
        onClose={handleCloseEditor}
        onRun={handleRun}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-[#F7F5FA] rounded animate-pulse" />
          <div className="h-9 w-36 bg-[#F7F5FA] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-[#F7F5FA] rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const activeSequences = sequences?.filter((s) => !s.isArchived) ?? [];

  // Empty state
  if (activeSequences.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#F7F5FA] flex items-center justify-center">
          <Layers className="w-7 h-7 text-[#A69DC0]" />
        </div>
        <h3 className="text-lg font-semibold text-[#403770] mb-2">
          Create your first sequence
        </h3>
        <p className="text-sm text-[#8A80A8] max-w-md mx-auto mb-6">
          Sequences let you build multi-step outreach flows with email, calls, texts, and LinkedIn messages.
          Create templates or write content inline, then run them against your contacts.
        </p>
        <button
          type="button"
          onClick={handleNewSequence}
          disabled={createSequence.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0605a] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {createSequence.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Sequence
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8A80A8]">
          {activeSequences.length} sequence{activeSequences.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={handleNewSequence}
          disabled={createSequence.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0605a] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {createSequence.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Sequence
        </button>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeSequences.map((sequence) => (
          <SequenceCard
            key={sequence.id}
            sequence={sequence}
            onClick={() => handleOpenSequence(sequence.id)}
            onArchive={() => handleArchive(sequence.id)}
          />
        ))}
      </div>
    </div>
  );
}
