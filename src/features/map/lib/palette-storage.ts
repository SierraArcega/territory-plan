import type { VendorId } from "@/features/map/lib/layers";
import {
  DEFAULT_VENDOR_PALETTE,
  DEFAULT_SIGNAL_PALETTE,
} from "@/features/map/lib/palettes";

const STORAGE_KEY = "territory-plan:palette-prefs";

const DEFAULT_VENDOR_OPACITIES: Record<VendorId, number> = {
  fullmind: 0.75,
  proximity: 0.75,
  elevate: 0.8,
  tbt: 0.75,
};

interface PalettePrefs {
  vendorPalettes: Record<VendorId, string>;
  signalPalette: string;
  vendorOpacities: Record<VendorId, number>;
}

export function loadPalettePrefs(): PalettePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
        signalPalette: DEFAULT_SIGNAL_PALETTE,
        vendorOpacities: { ...DEFAULT_VENDOR_OPACITIES },
      };
    const parsed = JSON.parse(raw);
    return {
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE, ...parsed.vendorPalettes },
      signalPalette: parsed.signalPalette ?? DEFAULT_SIGNAL_PALETTE,
      vendorOpacities: { ...DEFAULT_VENDOR_OPACITIES, ...parsed.vendorOpacities },
    };
  } catch {
    return {
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
      signalPalette: DEFAULT_SIGNAL_PALETTE,
      vendorOpacities: { ...DEFAULT_VENDOR_OPACITIES },
    };
  }
}

export function savePalettePrefs(prefs: PalettePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
