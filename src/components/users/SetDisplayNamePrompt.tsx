"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/lib/profile-actions";

/**
 * Shown once for any account whose profile still has the "New User"
 * placeholder (requirement 1) — e.g. an existing account created before a
 * real name was ever captured. Stops appearing on its own the moment a real
 * name replaces the placeholder; keeps reappearing on login until then.
 */
export function SetDisplayNamePrompt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateDisplayName(trimmed);
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set your display name"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">What&apos;s your name?</h2>
        <p className="mt-1 text-sm text-gray-500">
          This is how other people in your workspace will see you.
        </p>

        <label htmlFor="display-name" className="sr-only">
          Display name
        </label>
        <input
          id="display-name"
          type="text"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Your name"
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />

        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
