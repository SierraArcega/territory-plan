"use client";

// Toast — app-wide transient feedback messages.
//
// Mount <ToastProvider> once near the app root, then call:
//   const { showToast } = useToast();
//   showToast("Lead accepted", { tone: "success" });
//
// Toasts stack bottom-center, auto-dismiss after ~3.2s, and can be dismissed
// early by clicking. Tones: success (green check), info (steel info), alert
// (coral-red card). Visuals follow the leads design handoff: white card,
// radius 12, plum text, popover shadow; alert tone uses the alert palette
// (fg #C25A52 / bg #FEF1F0 / border #F7C9C5).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Portal } from "@/features/shared/lib/portal";

export type ToastTone = "success" | "info" | "alert";

export interface ToastOptions {
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 3200). */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

const DEFAULT_DURATION_MS = 3200;

const TONE_STYLES: Record<
  ToastTone,
  { card: string; icon: typeof Info; iconColor: string }
> = {
  success: {
    card: "border-[#D4CFE2] bg-white text-[#403770]",
    icon: CheckCircle2,
    iconColor: "text-[#69B34A]",
  },
  info: {
    card: "border-[#D4CFE2] bg-white text-[#403770]",
    icon: Info,
    iconColor: "text-[#6EA3BE]",
  },
  alert: {
    card: "border-[#F7C9C5] bg-[#FEF1F0] text-[#C25A52]",
    icon: AlertTriangle,
    iconColor: "text-[#C25A52]",
  },
};

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextToastId++;
      setToasts((prev) => [
        ...prev,
        { id, message, tone: options?.tone ?? "info" },
      ]);
      timersRef.current.set(
        id,
        setTimeout(
          () => dismissToast(id),
          options?.duration ?? DEFAULT_DURATION_MS,
        ),
      );
    },
    [dismissToast],
  );

  // Clear pending timers if the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <Portal>
          <style>{`@keyframes fm-toast-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
          >
            {toasts.map((toast) => {
              const tone = TONE_STYLES[toast.tone];
              const ToneIcon = tone.icon;
              return (
                <button
                  key={toast.id}
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label={`Dismiss: ${toast.message}`}
                  className={`flex max-w-[min(92vw,480px)] cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-[11px] text-left text-[13px] font-medium shadow-[0_10px_28px_-8px_rgba(64,55,112,0.22)] ${tone.card}`}
                  style={{
                    animation:
                      "fm-toast-up 220ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <ToneIcon
                    size={15}
                    className={`shrink-0 ${tone.iconColor}`}
                    aria-hidden
                  />
                  <span className="min-w-0">{toast.message}</span>
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
}
