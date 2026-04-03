"use client";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import TemplateCard from "./TemplateCard";
import TemplateEditor from "./TemplateEditor";
import { useEngageTemplates, useArchiveTemplate } from "../lib/queries";

export default function TemplatesTab() {
  const { data: templates, isLoading } = useEngageTemplates();
  const archiveTemplate = useArchiveTemplate();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);

  const handleNewTemplate = () => {
    setEditingId(undefined);
    setEditorOpen(true);
  };

  const handleEditTemplate = (id: number) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditingId(undefined);
  };

  const handleArchive = (id: number) => {
    archiveTemplate.mutate(id);
  };

  // Loading state — 6 skeleton cards
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#403770]">Templates</h2>
          <div className="h-9 w-36 bg-[#EFEDF5] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#D4CFE2] rounded-xl p-4 animate-pulse"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#EFEDF5]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-[#EFEDF5] rounded" />
                  <div className="h-3 w-16 bg-[#F7F5FA] rounded" />
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="h-3.5 w-full bg-[#F7F5FA] rounded" />
                <div className="h-3.5 w-3/4 bg-[#F7F5FA] rounded" />
              </div>
              <div className="h-3 w-24 bg-[#F7F5FA] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeTemplates = templates?.filter((t) => !t.isArchived) ?? [];

  // Empty state
  if (activeTemplates.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#403770]">Templates</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#F7F5FA] border border-[#E2DEEC] flex items-center justify-center mb-5">
            <FileText className="w-8 h-8 text-[#A69DC0]" />
          </div>
          <h3 className="text-lg font-semibold text-[#403770] mb-2">
            No templates yet
          </h3>
          <p className="text-sm text-[#6B5F8A] mb-6 text-center max-w-md">
            Create reusable email templates with merge fields. Templates can be
            used across multiple sequences to keep your outreach consistent.
          </p>
          <button
            onClick={handleNewTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0625a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Template
          </button>
        </div>

        {editorOpen && (
          <TemplateEditor
            templateId={editingId}
            onClose={handleCloseEditor}
          />
        )}
      </div>
    );
  }

  // Populated state
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[#403770]">Templates</h2>
        <button
          onClick={handleNewTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0625a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => handleEditTemplate(template.id)}
            onArchive={() => handleArchive(template.id)}
          />
        ))}
      </div>

      {editorOpen && (
        <TemplateEditor
          templateId={editingId}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
