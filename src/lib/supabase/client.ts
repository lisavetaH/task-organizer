import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Safe for Client Components. Uses ONLY the public anon key
 * (NEXT_PUBLIC_SUPABASE_ANON_KEY). The service-role key must never
 * be imported into any browser-reachable module.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
