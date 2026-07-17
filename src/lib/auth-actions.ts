"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | undefined;

/**
 * Email + password sign-up.
 *
 * The display name is passed as user metadata (`full_name`). The approved
 * `handle_new_user` database trigger reads that metadata to create the
 * matching `profiles` row using the auth user id — the client never sends
 * or controls the profile id.
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const redirectTo = safeRedirect(String(formData.get("redirect") ?? ""));

  if (!email || !password || !fullName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is OFF, a session now exists and the redirect
  // lands on the target. If confirmation is ON, the user must confirm first;
  // middleware will keep them at /login until then.
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

/** Email + password login. */
export async function logIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirect(String(formData.get("redirect") ?? ""));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

/**
 * Only allow same-site relative redirects (must start with a single "/").
 * Prevents open-redirect via a crafted ?redirect= value.
 */
function safeRedirect(value: string): string {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/today";
}

/** Sign the current user out and return to the login screen. */
export async function logOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
