"use client";

import type { DistrictDetail } from "@/lib/api";
import SignalCard from "./signals/SignalCard";
import TagsEditor from "./TagsEditor";
import NotesEditor from "./NotesEditor";
import TaskList from "@/components/tasks/TaskList";

interface DistrictDetailsCardProps {
  data: DistrictDetail;
  leaid: string;
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function DistrictDetailsCard({ data, leaid }: DistrictDetailsCardProps) {
  const d = data.district;
  const hasAddress = d.streetLocation || d.cityLocation;
  const formatted = formatPhone(d.phone);

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      }
      title="District Details"
      badge={<></>}
    >
      <div className="space-y-4">
        {(hasAddress || d.phone) && (
          <div className="space-y-1 text-sm">
            {hasAddress && (
              <p className="text-gray-600">
                {d.streetLocation && <>{d.streetLocation}<br /></>}
                {d.cityLocation}, {d.stateLocation} {d.zipLocation}
              </p>
            )}
            {formatted && (
              <a href={`tel:${d.phone}`} className="text-[#6EA3BE] hover:underline">
                {formatted}
              </a>
            )}
          </div>
        )}
        <TagsEditor leaid={leaid} tags={data.tags} />
        <NotesEditor leaid={leaid} edits={data.edits} />
        <TaskList linkedEntityType="district" linkedEntityId={leaid} />
      </div>
    </SignalCard>
  );
}
