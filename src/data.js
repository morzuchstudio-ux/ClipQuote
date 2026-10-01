export const categories = [
  "All",
  "😂 Humor",
  "😏 Sarcasm",
  "🎉 Celebration",
  "🤯 Surprise",
  "😤 Frustration",
  "💪 Motivation",
];
// Curated example scenes. Availability and embedding are controlled by YouTube uploaders.
export const seedClips = [
  {
    id: "office-no",
    videoId: "31g0YE61PLQ",
    start: 0,
    end: 8,
    quote: "No. God. Please, no!",
    source: "The Office",
    speaker: "Michael Scott",
    category: "😤 Frustration",
    tags: ["nie", "poniedziałek", "praca", "odmowa"],
    color: "#687157",
  },
  {
    id: "fine",
    videoId: "P7TnA_8379E",
    start: 0,
    end: 10,
    quote: "I'm fine. Totally fine.",
    source: "Friends",
    speaker: "Ross Geller",
    category: "😏 Sarcasm",
    tags: ["wszystko dobrze", "ironia", "stres"],
    color: "#a17454",
  },
  {
    id: "surprise",
    videoId: "ws59nvI6Ouk",
    start: 0,
    end: 7,
    quote: "Surprise, motherfucker!",
    source: "Dexter",
    speaker: "James Doakes",
    category: "🤯 Surprise",
    tags: ["niespodzianka", "zaskoczenie", "powrót"],
    color: "#77816f",
  },
  {
    id: "success",
    videoId: "3GwjfUFyY6M",
    start: 30,
    end: 42,
    quote: "Celebrate good times, come on!",
    source: "Kool & The Gang",
    speaker: "Celebration",
    category: "🎉 Celebration",
    tags: ["sukces", "udało się", "piątek", "impreza"],
    color: "#947055",
  },
  {
    id: "force",
    videoId: "pOVnogzqkXw",
    start: 0,
    end: 8,
    quote: "May the Force be with you.",
    source: "Star Wars",
    speaker: "Han Solo",
    category: "💪 Motivation",
    tags: ["powodzenia", "siła", "dasz radę"],
    color: "#626b5d",
  },
  {
    id: "rick",
    videoId: "dQw4w9WgXcQ",
    start: 43,
    end: 51,
    quote: "Never gonna give you up.",
    source: "Rick Astley",
    speaker: "Never Gonna Give You Up",
    category: "😂 Humor",
    tags: ["rickroll", "żart", "nigdy", "memy"],
    color: "#846653",
  },
  {
    id: "thinking",
    videoId: "8BxUfkZT8OA",
    start: 0,
    end: 8,
    quote: "You guys are getting paid?",
    source: "We're the Millers",
    speaker: "Kenny Rossmore",
    category: "🤯 Surprise",
    tags: ["pieniądze", "praca", "wypłata"],
    color: "#8d8e74",
  },
  {
    id: "doit",
    videoId: "ZXsQAXx_ao0",
    start: 3,
    end: 12,
    quote: "Just do it!",
    source: "Shia LaBeouf",
    speaker: "Motivational speech",
    category: "💪 Motivation",
    tags: ["zrób to", "motywacja", "działaj", "deadline"],
    color: "#646b5c",
  },
];
export function youtubeId(value) {
  try {
    const u = new URL(value);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, "");
    let id;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (
      ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
    )
      id =
        u.searchParams.get("v") ||
        u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}
export function seconds(value) {
  if (!/^\d+(?::[0-5]\d){0,2}$/.test(String(value))) return NaN;
  return String(value)
    .split(":")
    .reduce((n, p) => n * 60 + Number(p), 0);
}
export const time = (n) =>
  `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
export function validClip(c) {
  return (
    c &&
    typeof c.id === "string" &&
    (c.title === undefined ||
      (typeof c.title === "string" && c.title.length <= 120)) &&
    /^[\w-]{11}$/.test(c.videoId) &&
    Number.isInteger(c.start) &&
    Number.isInteger(c.end) &&
    c.start >= 0 &&
    c.end > c.start &&
    c.end <= 86400 &&
    typeof c.quote === "string" &&
    (c.quote.trim().length > 0 ||
      (typeof c.title === "string" && c.title.trim().length > 0)) &&
    c.quote.length <= 200 &&
    typeof c.source === "string" &&
    typeof c.speaker === "string" &&
    categories.includes(categoryLabel(c.category)) &&
    Array.isArray(c.tags) &&
    c.tags.every((t) => typeof t === "string")
  );
}
export function cleanClipMetadata(clip) {
  const { _kind, _ownerId, _legacyLink, ...data } = clip;
  return data;
}
export function sharedClip() {
  try {
    const raw = new URLSearchParams(location.hash.slice(1)).get("clip");
    if (!raw) return null;
    const c = JSON.parse(raw);
    return validClip(c) ? cleanClipMetadata(c) : null;
  } catch {
    return null;
  }
}

// Accept previously saved Polish category values without changing user content.
const legacyCategories = {
  Wszystkie: "All",
  "😏 Ironia": "😏 Sarcasm",
  "🎉 Radość": "🎉 Celebration",
  "🤯 Zaskoczenie": "🤯 Surprise",
  "😤 Frustracja": "😤 Frustration",
  "💪 Motywacja": "💪 Motivation",
};
export const categoryLabel = (value) => legacyCategories[value] || value;
export const demoClips = Array.from({ length: 10 }, (_, i) => ({
  ...seedClips[i % seedClips.length],
  id: `scroll-demo-${i + 1}`,
  title: `Demo · ${["Another Monday", "Everything is fine", "Unexpected visitor", "Time to celebrate", "You have got this", "A familiar surprise", "Wait, what?", "Make it happen", "One more meeting", "Keeping it together"][i]}`,
  tags: ["demo", "scroll preview"],
}));
