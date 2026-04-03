"use client";

import { useMemo } from "react";
import {
  ChevronLeft,
  X,
  CheckCircle2,
  SkipForward,
  XCircle,
  Mail,
  Phone,
  MessageSquare,
  Linkedin,
} from "lucide-react";
import {
  useExecution,
  useSendStepEmail,
  useCompleteStep,
  useSkipStep,
} from "../lib/queries";
import type { StepType, StepExecutionData } from "../types";
import { STEP_TYPE_LABELS } from "../types";
import EmailStepView from "./EmailStepView";
import ManualStepView from "./ManualStepView";

const STEP_ICONS: Record<StepType, React.ElementType> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

interface ExecutionPanelProps {
  executionId: number;
  onClose: () => void;
}

export default function ExecutionPanel({
  executionId,
  onClose,
}: ExecutionPanelProps) {
  const { data: execution, isLoading, refetch } = useExecution(executionId);
  const sendEmail = useSendStepEmail();
  const completeStep = useCompleteStep();
  const skipStep = useSkipStep();

  // Find the current pending step execution
  const currentStepExecution = useMemo(() => {
    if (!execution?.stepExecutions) return null;
    return execution.stepExecutions.find((se) => se.status === "pending") ?? null;
  }, [execution]);

  // Determine current step type from the sequence steps
  const currentStepType = useMemo((): StepType | null => {
    if (!execution || !currentStepExecution) return null;
    const step = execution.sequence.steps.find(
      (s) => s.id === currentStepExecution.stepId
    );
    return (step?.type as StepType) ?? null;
  }, [execution, currentStepExecution]);

  // Calculate progress stats
  const stats = useMemo(() => {
    if (!execution?.stepExecutions) {
      return { completed: 0, skipped: 0, failed: 0, pending: 0, total: 0 };
    }
    const all = execution.stepExecutions;
    return {
      completed: all.filter((se) => se.status === "completed").length,
      skipped: all.filter((se) => se.status === "skipped").length,
      failed: all.filter((se) => se.status === "failed").length,
      pending: all.filter((se) => se.status === "pending").length,
      total: all.length,
    };
  }, [execution]);

  const isAllDone = currentStepExecution === null && execution && !isLoading;

  // Find which step and contact index we're on for display
  const currentStepLabel = useMemo(() => {
    if (!execution || !currentStepExecution) return "";
    const step = execution.sequence.steps.find(
      (s) => s.id === currentStepExecution.stepId
    );
    if (!step) return "";
    return `Step ${step.position} of ${execution.sequence.steps.length}: ${STEP_TYPE_LABELS[step.type as StepType] || step.type}`;
  }, [execution, currentStepExecution]);

  const contactProgress = useMemo(() => {
    if (!execution) return "";
    const done = stats.completed + stats.skipped + stats.failed;
    return `${done + 1} of ${stats.total}`;
  }, [execution, stats]);

  const handleSendEmail = (subject: string, body: string) => {
    if (!currentStepExecution) return;
    sendEmail.mutate(
      {
        executionId,
        stepExecutionId: currentStepExecution.id,
        subject,
        body,
      },
      { onSuccess: () => refetch() }
    );
  };

  const handleCompleteStep = (notes: string) => {
    if (!currentStepExecution) return;
    completeStep.mutate(
      {
        executionId,
        stepExecutionId: currentStepExecution.id,
        notes,
      },
      { onSuccess: () => refetch() }
    );
  };

  const handleSkipStep = () => {
    if (!currentStepExecution) return;
    skipStep.mutate(
      {
        executionId,
        stepExecutionId: currentStepExecution.id,
      },
      { onSuccess: () => refetch() }
    );
  };

  // Loading state
  if (isLoading || !execution) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg
          className="animate-spin w-8 h-8 text-[#F37167] mb-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <p className="text-sm text-[#8A80A8]">Loading execution...</p>
      </div>
    );
  }

  // Progress bar percentage
  const progressPercent =
    stats.total > 0
      ? Math.round(
          ((stats.completed + stats.skipped + stats.failed) / stats.total) * 100
        )
      : 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#EFEDF5] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B5F8A]" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[#403770]">
              {execution.sequence.name}
            </h2>
            {!isAllDone && (
              <p className="text-xs text-[#8A80A8]">
                {currentStepLabel} &middot; Contact {contactProgress}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-[#EFEDF5] transition-colors"
        >
          <X className="w-4 h-4 text-[#6B5F8A]" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-[#6B5F8A]">
            Progress
          </span>
          <span className="text-xs text-[#8A80A8]">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-[#EFEDF5] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F37167] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-[#8A80A8]">
            <CheckCircle2 className="w-3 h-3 text-[#69B34A]" />
            {stats.completed} sent
          </span>
          <span className="flex items-center gap-1 text-xs text-[#8A80A8]">
            <SkipForward className="w-3 h-3 text-[#A69DC0]" />
            {stats.skipped} skipped
          </span>
          {stats.failed > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#8A80A8]">
              <XCircle className="w-3 h-3 text-[#F37167]" />
              {stats.failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="bg-white border border-[#D4CFE2] rounded-lg p-6 shadow-sm">
        {isAllDone ? (
          /* Completion summary */
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F7FFF2] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#69B34A]" />
            </div>
            <h3 className="text-lg font-semibold text-[#403770] mb-2">
              Sequence Complete
            </h3>
            <p className="text-sm text-[#8A80A8] mb-6">
              All steps have been processed.
            </p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#69B34A]">
                  {stats.completed}
                </p>
                <p className="text-xs text-[#8A80A8]">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#A69DC0]">
                  {stats.skipped}
                </p>
                <p className="text-xs text-[#8A80A8]">Skipped</p>
              </div>
              {stats.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#F37167]">
                    {stats.failed}
                  </p>
                  <p className="text-xs text-[#8A80A8]">Failed</p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e05e54] transition-colors"
            >
              Done
            </button>
          </div>
        ) : currentStepExecution && currentStepType === "email" ? (
          <EmailStepView
            stepExecution={currentStepExecution}
            onSend={handleSendEmail}
            onSkip={handleSkipStep}
            isSending={sendEmail.isPending}
          />
        ) : currentStepExecution && currentStepType ? (
          <ManualStepView
            stepExecution={currentStepExecution}
            stepType={currentStepType}
            onComplete={handleCompleteStep}
            onSkip={handleSkipStep}
            isCompleting={completeStep.isPending}
          />
        ) : null}
      </div>
    </div>
  );
}
