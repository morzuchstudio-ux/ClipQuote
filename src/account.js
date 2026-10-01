import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { flowType: "pkce", detectSessionInUrl: true } },
);
export function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}
export async function saveOnline(clip, userId) {
  // Always create a personal copy; never accept another user's ownership or ID.
  const id = crypto.randomUUID();
  const clean = { ...clip, id };
  unwrap(await supabase.from("clips").insert({ id, owner_id: userId, data: clean }));
  return clean;
}
