"use client";

import { useState, useMemo, useEffect } from "react";
import { Info, X } from "lucide-react";
import type { SequenceStepData } from "../types";

interface TemplateChangeBannerProps {
  steps: SequenceStepData[];
}

function getDismissKey(templateId: number, updatedAt: string): string {
  return `engage-template-change-dismissed-${templateId}-${updatedAt}`;
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

interface ChangedTemplate {
  templateId: number;
  templateName: string;
  updatedAt: string;
  stepPositions: number[];
}

export default function TemplateChangeBanner({ steps }: TemplateChangeBannerProps) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  // Load dismissed keys from localStorage on mount
  useEffect(() => {
    const keys = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("engage-template-change-dismissed-")) {
        keys.add(key);
      }
    }
    setDismissedKeys(keys);
  }, []);

  const changedTemplates = useMemo(() => {
    const templates: ChangedTemplate[] = [];
    const seen = new Set<number>();

    for (const step of steps) {
      if (!step.template || !step.templateId) continue;
      if (!isWithinDays(step.template.updatedAt, 7)) continue;

      const key = getDismissKey(step.templateId, step.template.updatedAt);
      if (dismissedKeys.has(key)) continue;

      if (!seen.has(step.templateId)) {
        seen.add(step.templateId);
        templates.push({
          templateId: step.templateId,
          templateName: step.template.name,
          updatedAt: step.template.updatedAt,
          stepPositions: [step.position],
        });
      } else {
        const existing = templates.find((t) => t.templateId === step.templateId);
        existing?.stepPositions.push(step.position);
      }
    }

    return templates;
  }, [steps, dismissedKeys]);

  const handleDismiss = (templateId: number, updatedAt: string) => {
    const key = getDismissKey(templateId, updatedAt);
    localStorage.setItem(key, "1");
    setDismissedKeys((prev) => new Set([...prev, key]));
  };

  if (changedTemplates.length === 0) return null;

  return (
    <div className="space-y-2">
      {changedTemplates.map((ct) => (
        <div
          key={ct.templateId}
          className="flex items-start gap-3 px-4 py-3 bg-[#e8f1f5] rounded-lg border border-[#8bb5cb]/30"
        >
          <Info className="w-5 h-5 text-[#6EA3BE] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#6EA3BE]">
              Template &ldquo;<span className="font-medium">{ct.templateName}</span>&rdquo; was
              updated {formatRelativeDate(ct.updatedAt)}. Review step{" "}
              {ct.stepPositions.join(", ")} to make sure the latest content looks right.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(ct.templateId, ct.updatedAt)}
            className="p-1 rounded text-[#8bb5cb] hover:text-[#6EA3BE] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
