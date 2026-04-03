"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  SkipForward,
  XCircle,
  Phone,
  Mail,
  MessageSquare,
  Linkedin,
  X,
} from "lucide-react";
import { useExecution } from "../lib/queries";
import type { StepType, StepExecutionData, SequenceStepData } from "../types";
import { STEP_TYPE_LABELS, EXECUTION_STATUS_CONFIG } from "../types";

const STEP_ICONS: Record<StepType, React.ElementType> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  completed: { icon: CheckCircle2, color: "#69B34A" },
  skipped: { icon: SkipForward, color: "#A69DC0" },
  failed: { icon: XCircle, color: "#F37167" },
  pending: { icon: Mail, color: "#D4CFE2" },
};

interface ExecutionDetailViewProps {
  executionId: number;
  onClose: () => void;
}

export default function ExecutionDetailView({
  executionId,
  onClose,
}: ExecutionDetailViewProps) {
  const { data: execution, isLoading } = useExecution(executionId);
  const [selectedCell, setSelectedCell] = useState<StepExecutionData | null>(null);

  // Group step executions by contact
  const contactGrid = useMemo(() => {
    if (!execution?.stepExecutions) return [];

    const contactMap = new Map<
      number,
      { contact: StepExecutionData["contact"]; steps: Map<number, StepExecutionData> }
    >();

    for (const se of execution.stepExecutions) {
      if (!contactMap.has(se.contactId)) {
        contactMap.set(se.contactId, { contact: se.contact, steps: new Map() });
      }
      contactMap.get(se.contactId)!.steps.set(se.stepId, se);
    }

    return Array.from(contactMap.values());
  }, [execution]);

  // Summary stats
  const stats = useMemo(() => {
    if (!execution?.stepExecutions) {
      return { sent: 0, skipped: 0, failed: 0, total: 0 };
    }
    const all = execution.stepExecutions;
    return {
      sent: all.filter((se) => se.status === "completed").length,
      skipped: all.filter((se) => se.status === "skipped").length,
      failed: all.filter((se) => se.status === "failed").length,
      total: all.length,
    };
  }, [execution]);

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
        <p className="text-sm text-[#8A80A8]">Loading execution details...</p>
      </div>
    );
  }

  const steps = execution.sequence.steps || [];
  const statusConfig = EXECUTION_STATUS_CONFIG[execution.status];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-[#EFEDF5] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[#6B5F8A]" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#403770] truncate">
              {execution.sequence.name}
            </h2>
            <span
              className="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full"
              style={{
                color: statusConfig.color,
                backgroundColor: statusConfig.bgColor,
              }}
            >
              {statusConfig.label}
            </span>
          </div>
          <p className="text-xs text-[#8A80A8]">
            Started {new Date(execution.startedAt).toLocaleDateString()}
            {execution.completedAt &&
              ` · Completed ${new Date(execution.completedAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-[#D4CFE2] rounded-lg p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-[#403770]">{stats.total}</p>
          <p className="text-xs text-[#8A80A8]">Total Steps</p>
        </div>
        <div className="bg-[#F7FFF2] border border-[#8AC670]/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-[#69B34A]">{stats.sent}</p>
          <p className="text-xs text-[#8A80A8]">Completed</p>
        </div>
        <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-[#A69DC0]">{stats.skipped}</p>
          <p className="text-xs text-[#8A80A8]">Skipped</p>
        </div>
        <div className="bg-[#fef1f0] border border-[#f58d85]/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-[#F37167]">{stats.failed}</p>
          <p className="text-xs text-[#8A80A8]">Failed</p>
        </div>
      </div>

      {/* Per-step breakdown */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
          Step Breakdown
        </h3>
        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = STEP_ICONS[step.type as StepType] || Mail;
            const stepExecs = execution.stepExecutions.filter(
              (se) => se.stepId === step.id
            );
            const completed = stepExecs.filter(
              (se) => se.status === "completed"
            ).length;
            const skipped = stepExecs.filter(
              (se) => se.status === "skipped"
            ).length;
            const failed = stepExecs.filter(
              (se) => se.status === "failed"
            ).length;

            return (
              <div
                key={step.id}
                className="flex items-center gap-3 bg-white border border-[#D4CFE2] rounded-lg px-4 py-3 shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-[#F7F5FA] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#403770]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#403770]">
                    Step {step.position}:{" "}
                    {STEP_TYPE_LABELS[step.type as StepType] || step.type}
                  </p>
                  {step.subject && (
                    <p className="text-xs text-[#8A80A8] truncate">
                      {step.subject}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#8A80A8]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#69B34A]" />
                    {completed}
                  </span>
                  <span className="flex items-center gap-1">
                    <SkipForward className="w-3 h-3 text-[#A69DC0]" />
                    {skipped}
                  </span>
                  {failed > 0 && (
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-[#F37167]" />
                      {failed}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-contact grid */}
      <div>
        <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
          Contact Details
        </h3>
        <div className="border border-[#D4CFE2] rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5FA]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider sticky left-0 bg-[#F7F5FA]">
                    Contact
                  </th>
                  {steps.map((step) => {
                    const Icon = STEP_ICONS[step.type as StepType] || Mail;
                    return (
                      <th
                        key={step.id}
                        className="text-center px-3 py-3 text-xs font-semibold text-[#6B5F8A]"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Icon className="w-3 h-3" />
                          <span>Step {step.position}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {contactGrid.map((row, idx) => (
                  <tr
                    key={row.contact.id}
                    className={idx > 0 ? "border-t border-[#E2DEEC]" : undefined}
                  >
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div>
                        <span className="font-medium text-[#403770]">
                          {row.contact.name}
                        </span>
                        {row.contact.title && (
                          <p className="text-xs text-[#8A80A8]">
                            {row.contact.title}
                          </p>
                        )}
                      </div>
                    </td>
                    {steps.map((step) => {
                      const se = row.steps.get(step.id);
                      if (!se) {
                        return (
                          <td key={step.id} className="text-center px-3 py-3">
                            <span className="text-[#D4CFE2]">—</span>
                          </td>
                        );
                      }
                      const statusInfo = STATUS_ICONS[se.status] || STATUS_ICONS.pending;
                      const StatusIcon = statusInfo.icon;
                      return (
                        <td key={step.id} className="text-center px-3 py-3">
                          <button
                            onClick={() => setSelectedCell(se)}
                            className="inline-flex p-1 rounded hover:bg-[#EFEDF5] transition-colors"
                            title={`${se.status} — click to view details`}
                          >
                            <StatusIcon
                              className="w-4 h-4"
                              style={{ color: statusInfo.color }}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cell detail mini-modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[#403770]/20 backdrop-blur-sm"
            onClick={() => setSelectedCell(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#403770]">
                  {selectedCell.contact.name}
                </h3>
                <p className="text-xs text-[#8A80A8]">
                  Status:{" "}
                  <span
                    className="font-medium"
                    style={{
                      color:
                        STATUS_ICONS[selectedCell.status]?.color || "#A69DC0",
                    }}
                  >
                    {selectedCell.status}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-2 rounded-lg hover:bg-[#EFEDF5] transition-colors"
              >
                <X className="w-4 h-4 text-[#6B5F8A]" />
              </button>
            </div>

            {selectedCell.sentSubject && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1">
                  Subject
                </label>
                <p className="text-sm text-[#403770]">
                  {selectedCell.sentSubject}
                </p>
              </div>
            )}

            {selectedCell.sentBody && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1">
                  Content
                </label>
                <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg px-4 py-3 max-h-60 overflow-y-auto">
                  <p className="text-sm text-[#403770] whitespace-pre-wrap">
                    {selectedCell.sentBody}
                  </p>
                </div>
              </div>
            )}

            {selectedCell.notes && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1">
                  Notes
                </label>
                <p className="text-sm text-[#6B5F8A] whitespace-pre-wrap">
                  {selectedCell.notes}
                </p>
              </div>
            )}

            {selectedCell.completedAt && (
              <p className="text-xs text-[#A69DC0]">
                Completed{" "}
                {new Date(selectedCell.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
