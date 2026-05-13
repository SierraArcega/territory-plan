"use client";

/**
 * DistrictDetailContent — body for `kind === 'district'`.
 *
 * D1 placeholder — D2 fills in the real prototype-spec'd fields. This stub
 * exists so DetailPanel's ContentSwitch dispatcher compiles before D2 lands.
 */
import { MapPin } from "lucide-react";
import DetailPanelHeader from "./DetailPanelHeader";
import { PanelBodySkeleton } from "./atoms";

interface Props {
  id: string;
  onClose: () => void;
}

export default function DistrictDetailContent({ id, onClose }: Props) {
  return (
    <>
      <DetailPanelHeader
        eyebrowIcon={<MapPin className="w-2.5 h-2.5" aria-hidden />}
        eyebrow="District"
        title={`District ${id}`}
        onClose={onClose}
        secondaryActionLabel="Add to list"
      />
      <PanelBodySkeleton />
    </>
  );
}
