// Permanently deletes the calling user's own account via the official
// Supabase Admin API (auth.admin.deleteUser), instead of a direct SQL
// DELETE FROM auth.users. See supabase/migrations/012_edge_function_account_deletion.sql
// for the full rationale.
//
// The owner-block check and invitation cleanup (prepare_own_account_deletion)
// run first, using a client scoped to the CALLER's own JWT -- auth.uid() and
// RLS behave exactly as if the caller had invoked the RPC directly, no
// elevated privilege involved. Only after that succeeds does this function
// use the service-role client -- for exactly one call, auth.admin.deleteUser
// -- and only for the same user who was just authorized. The service-role
// key is never read from anywhere but this function's own runtime; Supabase
// injects it automatically into every Edge Function, so it never enters this
// repo, Vercel, or any value handled outside Supabase's own infrastructure.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const { error: prepError } = await userClient.rpc("prepare_own_account_deletion");
  if (prepError) {
    return new Response(JSON.stringify({ error: prepError.message }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
});
