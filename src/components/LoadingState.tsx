import { Loader2 } from "lucide-react";

/**
 * Generic full-area loading indicator. Used by route-level loading.tsx
 * files and anywhere an async section is pending.
 */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
