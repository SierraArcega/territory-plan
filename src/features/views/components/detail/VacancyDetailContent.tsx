"use client";

/**
 * VacancyDetailContent — body for `kind === 'vacancy'`.
 *
 * D1 placeholder — D2 fills in the real prototype-spec'd fields.
 */
import { MapPin } from "lucide-react";
import DetailPanelHeader from "./DetailPanelHeader";
import { PanelBodySkeleton } from "./atoms";

interface Props {
  id: string;
  onClose: () => void;
}

export default function VacancyDetailContent({ id, onClose }: Props) {
  return (
    <>
      <DetailPanelHeader
        eyebrowIcon={<MapPin className="w-2.5 h-2.5" aria-hidden />}
        eyebrow="Vacancy"
        title={`Vacancy ${id}`}
        onClose={onClose}
        secondaryActionLabel="Save"
      />
      <PanelBodySkeleton />
    </>
  );
}
