import clips from './clips.js';

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Serve the same app to people and preview crawlers, with metadata already in HTML.
export function createSharePage(loadTemplate, lookup = clips) {
  return async function sharePage(request) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const id = url.pathname.startsWith('/c/') ? url.pathname.slice(3) : url.searchParams.get('id');
    const validId = /^(?:[\w-]{16}|[a-f0-9]{24})$/.test(id || '');
    let status = 404, clip;
    if (validId) {
      const result = await lookup(new Request(`https://clipquote.local/api/clips/${id}`));
      status = result.status;
      if (result.ok) {
        clip = (await result.json()).clip;
        if (!clip || !/^[\w-]{11}$/.test(clip.videoId)) { clip = null; status = 404; }
      }
    }
    const title = clip ? String(clip.title || clip.quote || 'Watch this clip') : 'Clip unavailable';
    const description = clip
      ? [clip.quote && clip.quote !== title ? clip.quote : '', clip.source, 'Watch this moment on ClipQuote.'].filter(Boolean).join(' · ')
      : 'This clip is unavailable. Explore more scenes on ClipQuote.';
    const meta = (name, value, attribute = 'property') => `<meta ${attribute}="${name}" content="${escapeHTML(value)}" />`;
    const tags = [
      `<title>${escapeHTML(title)} · ClipQuote</title>`,
      meta('description', description, 'name'),
      meta('og:site_name', 'ClipQuote'), meta('og:type', 'website'),
      meta('og:title', title), meta('og:description', description),
      meta('twitter:title', title, 'name'), meta('twitter:description', description, 'name'),
    ];
    if (validId) {
      const canonical = `https://clipquote.vercel.app/c/${id}`;
      tags.push(meta('og:url', canonical), `<link rel="canonical" href="${canonical}" />`);
    }
    if (clip) {
      // YouTube's standard thumbnail is available without downloading the video.
      const image = `https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg`;
      tags.push(meta('og:image', image), meta('og:image:secure_url', image),
        meta('og:image:type', 'image/jpeg'), meta('og:image:width', '480'), meta('og:image:height', '360'),
        meta('og:image:alt', title), meta('twitter:card', 'summary_large_image', 'name'),
        meta('twitter:image', image, 'name'), meta('twitter:image:alt', title, 'name'),
        `<link rel="image_src" href="${image}" />`);
    } else {
      tags.push(meta('robots', 'noindex', 'name'));
    }
    const template = await loadTemplate(url.pathname);
    const html = template.replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name="description"[\s\S]*?>/i, '')
      .replace('</head>', `${tags.join('\n')}\n</head>`);
    return new Response(request.method === 'HEAD' ? null : html, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  };
}
