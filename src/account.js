import { cleanClipMetadata } from "./data";
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
  const clean = { ...cleanClipMetadata(clip), id };
  unwrap(await supabase.from("clips").insert({ id, owner_id: userId, data: clean }));
  return clean;
}
export async function updateOnline(original, changes) {
  const data = { ...cleanClipMetadata(original), ...cleanClipMetadata(changes), id: original.id };
  if (original._legacyLink) {
    unwrap(await supabase.rpc("admin_update_legacy_clip", { clip_key: original._legacyLink, clip_data: data }));
  } else {
    // RLS allows only the owner or an approved admin. Keep the row and shared link IDs.
    unwrap(await supabase.from("clips").update({ data }).eq("id", original.id).select("id").single());
  }
  return { ...original, ...data };
}
