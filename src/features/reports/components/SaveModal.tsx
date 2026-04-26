"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { QueryParams } from "../lib/types";
import { useSaveReportMutation } from "../lib/queries";

interface Props {
  open: boolean;
  onClose: () => void;
  params: QueryParams;
  isAdmin: boolean;
  onSaved: (id: number) => void;
}

type Visibility = "private" | "team";

export default function SaveModal({
  open,
  onClose,
  params,
  isAdmin,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("team");
  const [pinAsTeamDefault, setPinAsTeamDefault] = useState(false);
  const save = useSaveReportMutation();

  if (!open || typeof document === "undefined") return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const created = await save.mutateAsync({
      title: t,
      description: description.trim() || undefined,
      params,
    });
    onSaved(created.id);
    onClose();
    setTitle("");
    setDescription("");
    setPinAsTeamDefault(false);
    setVisibility("team");
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(64,55,112,0.45)]">
      <form
        onSubmit={submit}
        className="flex w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between px-7 pb-2 pt-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold text-[#544A78]">Save as Report</h2>
            <p className="text-[13px] text-[#6E6390]">
              Give it a name and decide who can see it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg bg-[#EFEDF5] text-lg font-medium text-[#8A80A8]"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5 px-7 pb-5 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#544A78]">
              Name
            </span>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-lg border-2 border-[#544A78] bg-white px-3.5 py-3 text-sm font-medium text-[#544A78] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#544A78]">
              Description (optional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg border border-[#C2BBD4] bg-white px-3.5 py-3 text-[13px] text-[#6E6390] outline-none resize-none"
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-[#544A78]">
              Visibility
            </legend>
            <div className="flex gap-2">
              {(["private", "team"] as const).map((v) => {
                const selected = visibility === v;
                return (
                  <label
                    key={v}
                    className={`flex w-[228px] cursor-pointer items-start gap-3 rounded-lg px-3.5 py-3 ${
                      selected
                        ? "border-2 border-plum bg-[#F5F2FB]"
                        : "border border-[#D4CFE2] bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={selected}
                      onChange={() => setVisibility(v)}
                      className="mt-1 size-[18px] accent-plum"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={`text-[13px] font-semibold ${selected ? "text-plum" : "text-[#544A78]"}`}
                      >
                        {v === "private" ? "Private" : "Team"}
                      </span>
                      <span className="text-[11px] text-[#8A80A8]">
                        {v === "private" ? "Only you can see it" : "Everyone at Fullmind"}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {isAdmin && (
            <label className="flex items-center gap-2.5 rounded-lg bg-[#fdfaf4] px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={pinAsTeamDefault}
                onChange={(e) => setPinAsTeamDefault(e.target.checked)}
                className="size-4 accent-plum"
              />
              <div className="flex flex-col gap-px">
                <span className="text-[13px] font-semibold text-[#544A78]">
                  Pin as team default
                </span>
                <span className="text-[11px] text-[#8A80A8]">
                  Shows at the top of the team library so anyone can re-run it
                </span>
              </div>
            </label>
          )}
        </div>

        <div className="h-px w-full bg-[#E2DEEC]" />

        <div className="flex items-center justify-between bg-[#F7F5FA] px-7 py-4">
          <p className="text-[11px] font-medium text-[#8A80A8]">
            Re-running this report is free — SQL runs without Claude.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#544A78]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || save.isPending}
              className="rounded-lg bg-plum px-[18px] py-2.5 text-[13px] font-semibold text-white hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
            >
              {save.isPending ? "Saving…" : "Save Report"}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
