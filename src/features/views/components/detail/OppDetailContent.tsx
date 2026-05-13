"use client";

/**
 * OppDetailContent — body for `kind === 'opp'`.
 *
 * D1 placeholder — D2 fills in the real prototype-spec'd fields.
 */
import DetailPanelHeader from "./DetailPanelHeader";
import { PanelBodySkeleton } from "./atoms";

interface Props {
  id: string;
  onClose: () => void;
}

export default function OppDetailContent({ id, onClose }: Props) {
  return (
    <>
      <DetailPanelHeader
        eyebrow="Opportunity"
        title={`Opportunity ${id}`}
        onClose={onClose}
        secondaryActionLabel="Save"
      />
      <PanelBodySkeleton />
    </>
  );
}
