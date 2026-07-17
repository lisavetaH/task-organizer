"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace } from "@/lib/folders";

/**
 * Shown when the signed-in user belongs to no workspace yet. Creating one
 * makes them its administrator (via the create_workspace RPC) and starts a
 * completely empty filing cabinet — no seeded folders.
 */
export function CreateWorkspace() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your workspace a name to continue.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createWorkspace(trimmed);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create workspace.");
      }
    });
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Set up your workspace
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          This is your filing cabinet. It starts empty — you&apos;ll build your
          own folders from here.
        </p>

        <label
          htmlFor="ws-name"
          className="mt-8 block text-sm font-medium text-gray-700"
        >
          Workspace name
        </label>
        <input
          id="ws-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Our Home, Smith Family, The Shop"
          className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />

        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onCreate}
          disabled={isPending}
          className="mt-6 w-full rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create workspace"}
        </button>
      </div>
    </main>
  );
}
