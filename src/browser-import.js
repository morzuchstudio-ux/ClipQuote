import { validClip } from "./data";
export function importBrowserLibrary() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("browser-import")) return "";
  try {
    const raw = params.get("browser-import");
    if (raw.length > 500000) throw new Error("Library is too large to transfer.");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.clips) || data.clips.length > 1000 || !data.clips.every(validClip))
      throw new Error("Invalid library.");
    const old = JSON.parse(localStorage.getItem("cq-clips") || "[]");
    const merged = new Map((Array.isArray(old) ? old : []).filter(validClip).map((c) => [c.id, c]));
    for (const clip of data.clips) if (!merged.has(clip.id)) merged.set(clip.id, clip);
    const oldFavorites = JSON.parse(localStorage.getItem("cq-favorites") || "[]");
    const favorites = [...(Array.isArray(oldFavorites) ? oldFavorites : []), ...(Array.isArray(data.favorites) ? data.favorites : [])]
      .filter((id) => typeof id === "string" && id.length <= 100);
    localStorage.setItem("cq-clips", JSON.stringify([...merged.values()]));
    localStorage.setItem("cq-favorites", JSON.stringify([...new Set(favorites)]));
    history.replaceState(null, "", location.pathname);
    return "";
  } catch {
    return "Could not transfer the browser library. Your original clips remain on the Netlify site.";
  }
}
