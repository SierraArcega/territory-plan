"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Save,
  Play,
  Loader2,
} from "lucide-react";
import {
  useSequence,
  useUpdateSequence,
  useDeleteStep,
  useReorderSteps,
} from "../lib/queries";
import StepCard from "./StepCard";
import AddStepModal from "./AddStepModal";
import MergeFieldSection from "./MergeFieldSection";
import TemplateChangeBanner from "./TemplateChangeBanner";

interface SequenceEditorProps {
  sequenceId: number | null;
  onClose: () => void;
  onRun: (sequenceId: number) => void;
}

export default function SequenceEditor({ sequenceId, onClose, onRun }: SequenceEditorProps) {
  const { data: sequence, isLoading } = useSequence(sequenceId);
  const updateSequence = useUpdateSequence();
  const deleteStep = useDeleteStep();
  const reorderSteps = useReorderSteps();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<number | null>(null);

  // Sync form state when sequence loads
  useEffect(() => {
    if (sequence) {
      setName(sequence.name);
      setDescription(sequence.description ?? "");
    }
  }, [sequence]);

  const handleSave = useCallback(async () => {
    if (!sequenceId || !name.trim()) return;
    await updateSequence.mutateAsync({
      id: sequenceId,
      name: name.trim(),
      description: description.trim() || null,
    });
  }, [sequenceId, name, description, updateSequence]);

  const handleRemoveStep = useCallback(
    async (stepId: number) => {
      if (!sequenceId) return;
      await deleteStep.mutateAsync({ sequenceId, stepId });
    },
    [sequenceId, deleteStep]
  );

  const handleDragReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!sequence || !sequenceId) return;
      const stepIds = sequence.steps
        .sort((a, b) => a.position - b.position)
        .map((s) => s.id);

      const [moved] = stepIds.splice(fromIndex, 1);
      stepIds.splice(toIndex, 0, moved);

      await reorderSteps.mutateAsync({ sequenceId, stepIds });
    },
    [sequence, sequenceId, reorderSteps]
  );

  const sortedSteps = sequence?.steps
    ? [...sequence.steps].sort((a, b) => a.position - b.position)
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#A69DC0] animate-spin" />
      </div>
    );
  }

  // Create mode (null id) just shows loading briefly before the parent creates it
  if (!sequence && sequenceId !== null) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-[#8A80A8]">Sequence not found</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-sm text-[#6EA3BE] hover:text-[#403770] transition-colors cursor-pointer"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sequence name..."
            className="w-full text-lg font-semibold text-[#403770] bg-transparent border-none focus:outline-none placeholder:text-[#A69DC0]"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="w-full text-sm text-[#8A80A8] bg-transparent border-none focus:outline-none placeholder:text-[#A69DC0] mt-0.5"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateSequence.isPending || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#403770] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {updateSequence.isPending ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Template change banner */}
      {sortedSteps.length > 0 && <TemplateChangeBanner steps={sortedSteps} />}

      {/* Steps list */}
      <div>
        <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
          Steps
        </h3>

        {sortedSteps.length === 0 ? (
          <div className="text-center py-10 bg-[#F7F5FA] rounded-lg border border-dashed border-[#D4CFE2]">
            <p className="text-sm text-[#8A80A8] mb-3">
              No steps yet. Add your first step to get started.
            </p>
            <button
              type="button"
              onClick={() => setShowAddStep(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSteps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                onEdit={() => setEditingStepId(step.id)}
                onRemove={() => handleRemoveStep(step.id)}
              />
            ))}

            <button
              type="button"
              onClick={() => setShowAddStep(true)}
              className="flex items-center gap-1.5 w-full justify-center py-2.5 text-sm font-medium text-[#6B5F8A] bg-[#F7F5FA] border border-dashed border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] hover:border-[#C2BBD4] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>
        )}
      </div>

      {/* Merge fields */}
      {sequenceId && sequence && (
        <div className="p-4 bg-white rounded-lg border border-[#D4CFE2] shadow-sm">
          <MergeFieldSection
            sequenceId={sequenceId}
            mergeFieldDefs={sequence.mergeFieldDefs}
            steps={sortedSteps}
          />
        </div>
      )}

      {/* Run button */}
      {sequenceId && sortedSteps.length > 0 && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => onRun(sequenceId)}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0605a] transition-colors shadow-sm cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Run Sequence
          </button>
        </div>
      )}

      {/* Add step modal */}
      {showAddStep && sequenceId && (
        <AddStepModal
          sequenceId={sequenceId}
          onClose={() => setShowAddStep(false)}
          onAdded={() => setShowAddStep(false)}
        />
      )}
    </div>
  );
}
