export default async function handler(request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.method === "POST")
    return Response.json({ error: "Sign in to create clips using the current app." }, { status: 401, headers });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const id = new URL(request.url).pathname.match(/^\/api\/clips\/([\w-]{16}|[a-f0-9]{24})$/)?.[1];
  if (!id) return Response.json({ error: "Invalid clip link." }, { status: 404, headers });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const result = await fetch(url + "/rest/v1/rpc/get_shared_clip", {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: id }), signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error("Storage error");
    const clip = await result.json();
    return Response.json(clip ? { clip } : { error: "Clip not found." }, { status: clip ? 200 : 404, headers });
  } catch {
    return Response.json({ error: "Clip storage is unavailable. Try again." }, { status: 503, headers });
  }
}
