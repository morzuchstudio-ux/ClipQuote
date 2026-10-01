import { getStore } from "@netlify/blobs";
const headers = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
export default async function handler(request) {
  // Legacy public links remain readable. All new writes go through Supabase RLS.
  if (request.method === "POST")
    return Response.json({ error: "Sign in to create clips using the current app." }, { status: 401, headers });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const id = new URL(request.url).pathname.match(/^\/api\/clips\/([\w-]{16})$/)?.[1];
  if (!id) return Response.json({ error: "Invalid clip link." }, { status: 404, headers });
  try {
    const clip = await getStore({ name: "shared-clips-v1", consistency: "strong" }).get(id, { type: "json" });
    return Response.json(clip ? { clip } : { error: "Clip not found." }, { status: clip ? 200 : 404, headers });
  } catch {
    return Response.json({ error: "Clip storage is unavailable. Try again." }, { status: 503, headers });
  }
}
export const config = { path: ["/api/clips", "/api/clips/:id"] };
