import { useEffect, useRef, useState } from "react";

const metadata = new Map();
function loadMetadata(id) {
  if (!metadata.has(id)) {
    metadata.set(id, fetch(`/api/video-metadata?id=${encodeURIComponent(id)}`)
      .then((r) => r.ok ? r.json() : {})
      .catch(() => ({})));
  }
  return metadata.get(id);
}

export default function VideoThumbnail({ videoId, alt }) {
  const ref = useRef();
  const fallback = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const [source, setSource] = useState(fallback);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSource(fallback);
    setHidden(false);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadMetadata(videoId).then((data) => {
        if (!cancelled && data.thumbnail) {
          setSource(data.thumbnail);
          setHidden(false);
        }
      });
    }, { rootMargin: "200px" });
    observer.observe(ref.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [videoId, fallback]);
  return <img ref={ref} loading="lazy" src={source} alt={alt}
    style={{ visibility: hidden ? "hidden" : undefined }}
    onError={() => {
      if (source !== fallback) setSource(fallback);
      else setHidden(true);
    }} />;
}
