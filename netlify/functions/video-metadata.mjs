export default async function handler(request) {
  if (request.method !== "GET")
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const id = new URL(request.url).searchParams.get("id");
  if (!/^[\w-]{11}$/.test(id || ""))
    return Response.json({ error: "Invalid video ID." }, { status: 400 });
  try {
    const url = new URL("https://www.youtube.com/oembed");
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
    url.searchParams.set("format", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Metadata unavailable");
    const data = await response.json();
    const thumbnail = new URL(data.thumbnail_url);
    if (thumbnail.protocol !== "https:" || !["i.ytimg.com", "img.youtube.com"].includes(thumbnail.hostname))
      throw new Error("Unexpected thumbnail host");
    return Response.json({ thumbnail: thumbnail.href, title: data.title || "" }, {
      headers: { "Cache-Control": "public, max-age=3600", "Netlify-CDN-Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return Response.json({ thumbnail: null }, { headers: { "Cache-Control": "public, max-age=300" } });
  }
}
export const config = { path: "/api/video-metadata" };
