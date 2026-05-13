"use client";

/**
 * ContactDetailContent — body for `kind === 'contact'`.
 *
 * D1 placeholder — D2 fills in the real prototype-spec'd fields.
 */
import { Users } from "lucide-react";
import DetailPanelHeader from "./DetailPanelHeader";
import { PanelBodySkeleton } from "./atoms";

interface Props {
  id: string;
  onClose: () => void;
}

export default function ContactDetailContent({ id, onClose }: Props) {
  return (
    <>
      <DetailPanelHeader
        eyebrowIcon={<Users className="w-2.5 h-2.5" aria-hidden />}
        eyebrow="Contact"
        title={`Contact ${id}`}
        onClose={onClose}
        secondaryActionLabel="Save"
      />
      <PanelBodySkeleton />
    </>
  );
}
