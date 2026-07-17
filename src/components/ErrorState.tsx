"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Generic error panel. Used by route-level error.tsx boundaries and any
 * component that needs to surface a recoverable failure. `onRetry` is
 * optional so it works both with and without a retry handler.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
      role="alert"
    >
      <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {message ? (
          <p className="mt-1 text-sm text-gray-500">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white active:bg-brand-dark"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
