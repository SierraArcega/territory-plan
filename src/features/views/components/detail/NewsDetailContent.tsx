"use client";

/**
 * NewsDetailContent — body for `kind === 'news'`.
 *
 * D1 placeholder — D2 fills in the real prototype-spec'd fields.
 */
import DetailPanelHeader from "./DetailPanelHeader";
import { PanelBodySkeleton } from "./atoms";

interface Props {
  id: string;
  onClose: () => void;
}

export default function NewsDetailContent({ id, onClose }: Props) {
  return (
    <>
      <DetailPanelHeader
        eyebrow="News"
        title={`Article ${id}`}
        onClose={onClose}
        secondaryActionLabel="Save"
      />
      <PanelBodySkeleton />
    </>
  );
}
