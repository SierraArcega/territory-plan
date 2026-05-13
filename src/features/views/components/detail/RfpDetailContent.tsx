"use client";

/**
 * RfpDetailContent — body for `kind === 'rfp'`.
 *
 * D1 placeholder — D2 fills in the real prototype-spec'd fields.
 */
import DetailPanelHeader from "./DetailPanelHeader";
import { PanelBodySkeleton } from "./atoms";

interface Props {
  id: string;
  onClose: () => void;
}

export default function RfpDetailContent({ id, onClose }: Props) {
  return (
    <>
      <DetailPanelHeader
        eyebrow="RFP"
        title={`RFP ${id}`}
        onClose={onClose}
        secondaryActionLabel="Save"
      />
      <PanelBodySkeleton />
    </>
  );
}
