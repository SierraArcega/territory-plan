"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import LayerBubble from "../LayerBubble";

interface LayersPanelProps {
  onClose: () => void;
}

/**
 * Wrapper that opens LayerBubble when the gear icon is clicked.
 * LayerBubble already has all vendor/signal/engagement/palette controls.
 * We just need to ensure it's open and close it when requested.
 */
export default function LayersPanel({ onClose }: LayersPanelProps) {
  // Open the LayerBubble when this panel mounts
  useEffect(() => {
    useMapV2Store.getState().setLayerBubbleOpen(true);
    return () => {
      useMapV2Store.getState().setLayerBubbleOpen(false);
    };
  }, []);

  // The LayerBubble renders itself in its own absolute position.
  // We don't render anything here — just control its open state.
  return null;
}
