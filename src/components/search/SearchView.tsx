"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, Pin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Result {
  item_id: string;
  folder_id: string;
  folder_name: string;
  title: string | null;
  body: string | null;
  scheduled_date: string | null;
  is_pinned: boolean;
  completed_at: string | null;
}

export function SearchView({ workspaceId }: { workspaceId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_items", {
        p_workspace_id: workspaceId,
        p_query: term,
      });
      if (cancelled) return;
      if (error) setError(error.message);
      else {
        setError(null);
        setResults((data ?? []) as Result[]);
      }
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, workspaceId]);

  return (
    <main>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2.5">
          <SearchIcon className="h-5 w-5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search folders and entries"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {q.trim().length < 2 ? (
        <p className="px-6 py-16 text-center text-sm text-gray-400">
          Type at least 2 characters to search folder names, titles, text, and
          attachment filenames.
        </p>
      ) : loading && results === null ? (
        <p className="px-6 py-16 text-center text-sm text-gray-400">Searching…</p>
      ) : results && results.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-gray-400">
          No matches in folders you can access.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {(results ?? []).map((r) => (
            <li key={r.item_id}>
              <Link href={`/folders/${r.folder_id}`} className="block px-4 py-3 active:bg-gray-50">
                <div className="flex items-center gap-1.5">
                  {r.is_pinned ? <Pin className="h-3.5 w-3.5 text-amber-500" /> : null}
                  <p className={`truncate text-base font-medium ${r.completed_at ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {r.title || r.body || "Untitled"}
                  </p>
                </div>
                {r.title && r.body ? (
                  <p className="truncate text-sm text-gray-500">{r.body}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-gray-400">in {r.folder_name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
