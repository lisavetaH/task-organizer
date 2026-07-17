"use client";

import { ErrorState } from "@/components/ErrorState";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <ErrorState message={error.message} onRetry={reset} />
    </div>
  );
}
