"use client";

import { useState } from "react";
import { useWatchers, useAddWatcher, useRemoveWatcher, useProfile } from "@/lib/api";
import UserSelect from "@/features/shared/components/UserSelect";
import PersonChip from "./PersonChip";

const PAGE = 50;

export default function WatchersEditor({ leaid }: { leaid: string }) {
  const { data: watchers, isLoading } = useWatchers(leaid);
  const { data: profile } = useProfile();
  const addMutation = useAddWatcher();
  const removeMutation = useRemoveWatcher();
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const list = watchers ?? [];
  const visible = showAll ? list : list.slice(0, PAGE);
  const pending = addMutation.isPending || removeMutation.isPending;
  const isWatching = !!profile && list.some((w) => w.userId === profile.id);

  const add = async (userId?: string) => {
    setError(null);
    try {
      await addMutation.mutateAsync({ leaid, userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add watcher");
    }
  };

  const remove = async (userId: string) => {
    setError(null);
    try {
      await removeMutation.mutateAsync({ leaid, userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove watcher");
    }
  };

  const toggleSelf = () => {
    if (!profile) return;
    if (isWatching) remove(profile.id);
    else add(profile.id);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <h4 className="text-xs font-bold text-[#403770]">Watchers</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelf}
            disabled={!profile || pending}
            className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
              isWatching
                ? "bg-[#403770] text-white border-[#403770]"
                : "text-[#403770] border-[#EFEDF5] hover:bg-[#F7F5FA]"
            }`}
          >
            {isWatching ? "Watching" : "Watch"}
          </button>
          <UserSelect
            excludeIds={list.map((w) => w.userId)}
            onSelect={(id) => add(id)}
            disabled={pending}
          />
        </div>
      </div>

      {error && (
        <div className="px-2.5 py-1.5 text-xs text-red-600 bg-red-50 rounded-md mb-2">{error}</div>
      )}

      {isLoading ? (
        <div className="text-sm text-[#A69DC0]">Loading…</div>
      ) : list.length === 0 ? (
        <span className="text-sm text-[#A69DC0] italic">No watchers</span>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {visible.map((w) => (
              <PersonChip
                key={w.userId}
                name={w.user.fullName}
                email={w.user.email}
                avatarUrl={w.user.avatarUrl}
                onRemove={() => remove(w.userId)}
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
