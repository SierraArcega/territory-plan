"use client";

import { useState } from "react";
import { useCollaborators, useAddCollaborator, useRemoveCollaborator } from "@/lib/api";
import UserSelect from "@/features/shared/components/UserSelect";
import PersonChip from "./PersonChip";

const PAGE = 50;

export default function CollaboratorsEditor({ leaid }: { leaid: string }) {
  const { data: collaborators, isLoading } = useCollaborators(leaid);
  const addMutation = useAddCollaborator();
  const removeMutation = useRemoveCollaborator();
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const list = collaborators ?? [];
  const visible = showAll ? list : list.slice(0, PAGE);
  const pending = addMutation.isPending || removeMutation.isPending;

  const add = async (userId: string) => {
    setError(null);
    try {
      await addMutation.mutateAsync({ leaid, userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add collaborator");
    }
  };

  const remove = async (userId: string) => {
    setError(null);
    try {
      await removeMutation.mutateAsync({ leaid, userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove collaborator");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <h4 className="text-xs font-bold text-[#403770]">Collaborators</h4>
        <UserSelect
          excludeIds={list.map((c) => c.userId)}
          onSelect={add}
          disabled={pending}
        />
      </div>

      {error && (
        <div className="px-2.5 py-1.5 text-xs text-red-600 bg-red-50 rounded-md mb-2">{error}</div>
      )}

      {isLoading ? (
        <div className="text-sm text-[#A69DC0]">Loading…</div>
      ) : list.length === 0 ? (
        <span className="text-sm text-[#A69DC0] italic">No collaborators</span>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {visible.map((c) => (
              <PersonChip
                key={c.userId}
                name={c.user.fullName}
                email={c.user.email}
                avatarUrl={c.user.avatarUrl}
                onRemove={() => remove(c.userId)}
                disabled={pending}
              />
            ))}
          </div>
          {list.length > PAGE && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-1.5 text-xs text-[#6EA3BE] hover:text-[#403770]"
            >
              Show all {list.length}
            </button>
          )}
        </>
      )}
    </div>
  );
}
