"use client";

import { useMemo, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import type { SequenceStepData, MergeFieldDefData } from "../types";
import { SYSTEM_MERGE_FIELDS, type SystemMergeFieldKey } from "../types";
import { extractMergeFieldKeys } from "../lib/merge-fields";

interface MergeFieldSectionProps {
  sequenceId: number;
  mergeFieldDefs: MergeFieldDefData[];
  steps: SequenceStepData[];
}

export default function MergeFieldSection({
  sequenceId,
  mergeFieldDefs,
  steps,
}: MergeFieldSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDefault, setNewDefault] = useState("");

  // Auto-detect system fields from all step content
  const detectedSystemFields = useMemo(() => {
    const allKeys = new Set<string>();

    for (const step of steps) {
      // Content comes from template or inline
      const body = step.template?.body ?? step.body ?? "";
      const subject = step.template?.subject ?? step.subject ?? "";

      for (const key of extractMergeFieldKeys(body)) {
        allKeys.add(key);
      }
      for (const key of extractMergeFieldKeys(subject)) {
        allKeys.add(key);
      }
    }

    // Filter to only system fields
    return Array.from(allKeys).filter(
      (key) => key in SYSTEM_MERGE_FIELDS
    ) as SystemMergeFieldKey[];
  }, [steps]);

  const customFields = mergeFieldDefs.filter((f) => f.type === "custom");

  const handleAddField = () => {
    if (!newName.trim() || !newLabel.trim()) return;
    // This would call an API to add a custom merge field definition.
    // For now, we reset the form. The mutation will be wired when the API route exists.
    setNewName("");
    setNewLabel("");
    setNewDefault("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
          Merge Fields
        </h3>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-xs font-medium text-[#6EA3BE] hover:text-[#403770] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom Field
        </button>
      </div>

      {/* Auto-detected system fields */}
      {detectedSystemFields.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-[#A69DC0] uppercase tracking-wider mb-1.5">
            System Fields (auto-detected)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {detectedSystemFields.map((key) => {
              const meta = SYSTEM_MERGE_FIELDS[key];
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#544A78] bg-[#F7F5FA] border border-[#E2DEEC] rounded-full"
                >
                  <Tag className="w-3 h-3 text-[#8A80A8]" />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {detectedSystemFields.length === 0 && customFields.length === 0 && !showAddForm && (
        <p className="text-xs text-[#A69DC0] py-2">
          No merge fields detected. Add {`{{field_name}}`} tags to your step content.
        </p>
      )}

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-[#A69DC0] uppercase tracking-wider mb-1.5">
            Custom Fields
          </p>
          <div className="space-y-1.5">
            {customFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between px-3 py-2 bg-[#F7F5FA] rounded-lg border border-[#E2DEEC]"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[#8A80A8]" />
                  <span className="text-sm font-medium text-[#403770]">
                    {field.label}
                  </span>
                  <code className="text-[10px] text-[#8A80A8] bg-[#EFEDF5] px-1.5 py-0.5 rounded">
                    {`{{${field.name}}}`}
                  </code>
                </div>
                {field.defaultValue && (
                  <span className="text-xs text-[#A69DC0]">
                    Default: {field.defaultValue}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add custom field form */}
      {showAddForm && (
        <div className="p-4 bg-[#F7F5FA] rounded-lg border border-[#E2DEEC] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#6B5F8A] block mb-1">
                Field Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) =>
                  setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                }
                placeholder="e.g. talking_point"
                className="w-full px-3 py-1.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-[#A69DC0]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B5F8A] block mb-1">
                Display Label
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Talking Point"
                className="w-full px-3 py-1.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-[#A69DC0]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#6B5F8A] block mb-1">
              Default Value (optional)
            </label>
            <input
              type="text"
              value={newDefault}
              onChange={(e) => setNewDefault(e.target.value)}
              placeholder="Fallback if not filled per-contact"
              className="w-full px-3 py-1.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-[#A69DC0]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddField}
              disabled={!newName.trim() || !newLabel.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Add Field
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
                setNewLabel("");
                setNewDefault("");
              }}
              className="p-1.5 text-[#A69DC0] hover:text-[#403770] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
