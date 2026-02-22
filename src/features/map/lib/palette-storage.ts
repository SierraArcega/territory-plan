import type { VendorId } from "@/features/map/lib/layers";
import {
  DEFAULT_VENDOR_PALETTE,
  DEFAULT_SIGNAL_PALETTE,
} from "@/features/map/lib/palettes";

const STORAGE_KEY = "territory-plan:palette-prefs";

interface PalettePrefs {
  vendorPalettes: Record<VendorId, string>;
  signalPalette: string;
}

export function loadPalettePrefs(): PalettePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
        signalPalette: DEFAULT_SIGNAL_PALETTE,
      };
    const parsed = JSON.parse(raw);
    return {
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE, ...parsed.vendorPalettes },
      signalPalette: parsed.signalPalette ?? DEFAULT_SIGNAL_PALETTE,
    };
  } catch {
    return {
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
      signalPalette: DEFAULT_SIGNAL_PALETTE,
    };
  }
}

export function savePalettePrefs(prefs: PalettePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
