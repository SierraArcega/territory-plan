"use client";

import { Play, Pause, X } from "lucide-react";
import type { SequenceExecutionData } from "../types";
import { EXECUTION_STATUS_CONFIG, STEP_TYPE_LABELS } from "../types";
import type { StepType } from "../types";
import { useUpdateExecutionStatus } from "../lib/queries";

interface ActiveRunCardProps {
  execution: SequenceExecutionData;
  onResume: (id: number) => void;
}

export default function ActiveRunCard({
  execution,
  onResume,
}: ActiveRunCardProps) {
  const updateStatus = useUpdateExecutionStatus();

  const statusConfig = EXECUTION_STATUS_CONFIG[execution.status];
  const totalSteps =
    execution.contactCount * (execution.sequence.steps?.length || 1);
  const progressPercent =
    totalSteps > 0
      ? Math.round((execution.completedCount / totalSteps) * 100)
      : 0;

  // Current step info
  const currentStep = execution.sequence.steps?.find(
    (s) => s.position === execution.currentStepPosition
  );
  const currentStepLabel = currentStep
    ? `Step ${currentStep.position}: ${STEP_TYPE_LABELS[currentStep.type as StepType] || currentStep.type}`
    : "";

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatus.mutate({ executionId: execution.id, status: "paused" });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatus.mutate({ executionId: execution.id, status: "cancelled" });
  };

  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    onResume(execution.id);
  };

  return (
    <div
      onClick={() => onResume(execution.id)}
      className="bg-white border border-[#D4CFE2] rounded-lg p-4 shadow-sm hover:border-[#C2BBD4] hover:shadow transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#403770] truncate">
            {execution.sequence.name}
          </h3>
          {currentStepLabel && (
            <p className="text-xs text-[#8A80A8] mt-0.5">{currentStepLabel}</p>
          )}
        </div>
        <span
          className="flex-shrink-0 ml-3 px-2 py-0.5 text-[10px] font-semibold rounded-full"
          style={{
            color: statusConfig.color,
            backgroundColor: statusConfig.bgColor,
          }}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#8A80A8]">
            {execution.completedCount} of {totalSteps} steps
          </span>
          <span className="text-xs text-[#8A80A8]">{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F37167] rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Contact count + actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#8A80A8]">
          {execution.contactCount} contact{execution.contactCount !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1">
          {execution.status === "paused" && (
            <button
              onClick={handleResume}
              className="p-1.5 rounded-lg hover:bg-[#F7FFF2] transition-colors"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5 text-[#69B34A]" />
            </button>
          )}
          {execution.status === "active" && (
            <button
              onClick={handlePause}
              disabled={updateStatus.isPending}
              className="p-1.5 rounded-lg hover:bg-[#fffaf1] transition-colors disabled:opacity-50"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5 text-[#FFCF70]" />
            </button>
          )}
          <button
            onClick={handleCancel}
            disabled={updateStatus.isPending}
            className="p-1.5 rounded-lg hover:bg-[#fef1f0] transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5 text-[#F37167]" />
          </button>
        </div>
      </div>
    </div>
  );
}
