import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  Plus,
  Play,
  Heart,
  ArrowUpRight,
  ArrowRight,
  X,
  Check,
  SlidersHorizontal,
  Grid2X2,
  Bookmark,
  Quote,
  Share2,
  Trash2,
  Scissors,
  Sun,
  Moon,
} from "lucide-react";
import {
  categories,
  categoryLabel,
  demoClips,
  seedClips,
  youtubeId,
  seconds,
  time,
  validClip,
  cleanClipMetadata,
  sharedClip,
} from "./data";
import "./style.css";
import ClipPlayer from "./ClipPlayer";
import { supabase, unwrap, saveOnline } from "./account";
import AccountPanel from "./AccountPanel";
import { importBrowserLibrary } from "./browser-import";
const browserImportError = importBrowserLibrary();
import VideoThumbnail from "./VideoThumbnail";
function read(key, fallback, validate) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return validate(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function Modal({ children, onClose, label, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current.showModal();
    return () => old?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <button
        className="close icon-button"
        aria-label="Close"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("cq-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#fafafa" : "#0f0f0f");
    try {
      localStorage.setItem("cq-theme", theme);
    } catch {}
  }, [theme]);
  const [custom, setCustom] = useState([]);
  const [managedClips, setManagedClips] = useState([]);
  const [hiddenExamples, setHiddenExamples] = useState([]);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("hidden_example_ids").then(({ data, error }) => {
      if (!cancelled && !error) setHiddenExamples(data || []);
    });
    return () => { cancelled = true; };
  }, []);
  const [favorites, setFavorites] = useState([]);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentUser = useRef(null);
  currentUser.current = session?.user.id;
  const [libraryError, setLibraryError] = useState(browserImportError);
  const [libraryAttempt, setLibraryAttempt] = useState(0);
  const [legacy, setLegacy] = useState(() => read("cq-clips", [], (v) => Array.isArray(v) && v.every(validClip)));
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ error }) => {
      if (error) { setLibraryError(error.message); setAuthLoading(false); }
    });
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has("error")) {
      setLibraryError("Google sign-in did not complete. Make sure your email is approved, then try again.");
      history.replaceState(null, "", location.pathname);
    }
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let stale = false;
    setCustom([]); setManagedClips([]); setFavorites([]); setRole(null);
    if (!session) return;
    (async () => {
      try {
        const nextRole = unwrap(await supabase.rpc("current_member_role"));
        if (stale) return;
        setRole(nextRole);
        if (!nextRole) { setLibraryError("Your account is not approved. Contact the administrator."); return; }
        const [clips, likes, managed] = await Promise.all([
          supabase.from("clips").select("id,data").eq("owner_id", session.user.id).order("created_at", { ascending: false }),
          supabase.from("favorites").select("clip_id").eq("owner_id", session.user.id),
          nextRole === "admin" ? supabase.rpc("admin_clip_catalog") : Promise.resolve({ data: [], error: null }),
        ]);
        const records = unwrap(clips).map((r) => ({ ...cleanClipMetadata(r.data), id: r.id })).filter(validClip);
        const ids = unwrap(likes).map((r) => r.clip_id);
        const catalog = unwrap(managed).filter(validClip);
        if (!stale) { setManagedClips(catalog); setCustom(records); setFavorites(ids); setLibraryError(""); }
      } catch (e) { if (!stale) setLibraryError("Could not load your online library. " + e.message); }
    })();
    return () => { stale = true; };
  }, [session?.user.id, libraryAttempt]);
  function requireAccount() {
    if (authLoading || !session || !role) { setAccountOpen(true); return false; }
    return true;
  }
  function openAdd() { if (requireAccount()) setAdding(true); }
  async function saveClip(c) {
    if (!requireAccount()) throw new Error("Sign in with an approved account first.");
    setSaving(true);
    try {
      const ownerId = session.user.id;
      const saved = await saveOnline(c, ownerId);
      if (currentUser.current !== ownerId) throw new Error("Account changed. The clip was saved to the original account.");
      setCustom((p) => [saved, ...p]); return saved;
    } finally { setSaving(false); }
  }
  async function importLegacy() {
    if (!requireAccount() || saving) return;
    setSaving(true);
    try {
      const mapping = {};
      for (const c of legacy) {
        const existing = custom.find((x) => x.legacyId === c.id);
        const saved = existing || await saveOnline({ ...c, legacyId: c.id }, session.user.id);
        mapping[c.id] = saved.id;
        if (!existing) setCustom((p) => [saved, ...p]);
      }
      const oldFavorites = read("cq-favorites", [], Array.isArray);
      const rows = oldFavorites.filter((id) => typeof id === "string" && (mapping[id] || seedClips.some((c) => c.id === id)))
        .map((id) => ({ owner_id: session.user.id, clip_id: mapping[id] || id }));
      if (rows.length) unwrap(await supabase.from("favorites").upsert(rows));
      setLegacy([]);
      // Keep the original browser data as a recovery copy.
      setLibraryAttempt((n) => n + 1);
      setToast("Browser clips imported. Originals remain on this device.");
    } catch (e) { setToast("Import stopped. Already imported clips are safe. " + e.message); }
    finally { setSaving(false); }
  }
  const [view, setView] = useState("discover"),
    [category, setCategory] = useState("All"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("popular"),
    [adding, setAdding] = useState(false),
    [active, setActive] = useState(sharedClip),
    [toast, setToast] = useState(""),
    [shareUrl, setShareUrl] = useState("");
  const searchRef = useRef();
  const librarySearchRef = useRef();
  function focusSearch() {
    librarySearchRef.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    searchRef.current?.focus({ preventScroll: true });
  }
  const [sharing, setSharing] = useState(false),
    [linkState, setLinkState] = useState(null),
    [linkAttempt, setLinkAttempt] = useState(0);
  const [route, setRoute] = useState(() => location.pathname);
  useEffect(() => {
    const update = () => setRoute(location.pathname);
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    if (!route.startsWith("/c/")) return;
    const controller = new AbortController();
    setLinkState({ loading: true });
    setActive(null);
    (/^[a-f0-9]{24}$/.test(route.slice(3))
      ? supabase.rpc("get_shared_clip", { link_id: route.slice(3) }).then(({ data, error }) =>
          ({ ok: !error && !!data, json: async () => ({ clip: data, error: error?.message || "Clip not found." }) }))
      : fetch(`/api/clips/${encodeURIComponent(route.slice(3))}`, { signal: controller.signal }))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !validClip(data.clip))
          throw new Error(data.error || "Invalid clip link.");
        if (!controller.signal.aborted) {
          setActive(cleanClipMetadata(data.clip));
          setLinkState(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLinkState({
            error:
              "Could not open this clip. " + (error.message || "Try again."),
          });
      });
    return () => controller.abort();
  }, [route, linkAttempt]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const onHash = () => setActive(sharedClip());
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        focusSearch();
      }
    };
    addEventListener("hashchange", onHash);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("hashchange", onHash);
      removeEventListener("keydown", onKey);
    };
  }, []);
  const all = [...custom,
    ...(role === "admin" ? managedClips.filter((c) => !custom.some((x) => x.id === c.id)) : []),
    ...[...seedClips, ...demoClips].filter((c) => !hiddenExamples.includes(c.id))];
  const norm = (s) =>
    s
      .toLocaleLowerCase("pl")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l");
  const filtered = all.filter(
    (c) =>
      (view !== "favorites" || favorites.includes(c.id)) &&
      (view !== "mine" || custom.some((x) => x.id === c.id)) &&
      (category === "All" || categoryLabel(c.category) === category) &&
      norm(
        [c.title, c.quote, c.source, c.speaker, ...c.tags].join(" "),
      ).includes(norm(query)),
  );
  if (sort === "az")
    filtered.sort((a, b) =>
      (a.title || a.quote).localeCompare(b.title || b.quote),
    );
  if (sort === "short")
    filtered.sort((a, b) => a.end - a.start - (b.end - b.start));
  async function favorite(id) {
    if (!requireAccount()) return;
    try {
      if (favorites.includes(id)) {
        unwrap(await supabase.from("favorites").delete().eq("owner_id", session.user.id).eq("clip_id", id));
        setFavorites((p) => p.filter((x) => x !== id));
      } else {
        unwrap(await supabase.from("favorites").upsert({ owner_id: session.user.id, clip_id: id }));
        setFavorites((p) => [...new Set([...p, id])]);
      }
    } catch (e) { setToast("Could not save favorite. " + e.message); }
  }
  async function share(c) {
    if (sharing) return;
    // Anyone can forward the public link they are already viewing.
    const existingLink = c._legacyLink ? new URL("/c/" + c._legacyLink, location.origin).href :
      route.startsWith("/c/") && active?.id === c.id ? location.href : null;
    if (!existingLink && !requireAccount()) return;
    setSharing(true);
    try {
      let url = existingLink;
      if (!url) {
        const owned = custom.find((x) => x.id === c.id || x.originalId === c.id);
        const saved = owned || await saveClip({ ...c, originalId: c.id });
        const id = unwrap(await supabase.rpc("share_clip", { clip_id: saved.id }));
        if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Invalid share link.");
        url = new URL("/c/" + id, location.origin).href;
      }
      try { await navigator.clipboard.writeText(url); setToast("Short link copied!"); }
      catch { setShareUrl(url); }
    } catch (e) { setToast("Could not create a link. " + e.message); }
    finally { setSharing(false); }
  }
  async function deleteClip(c) {
    if (!requireAccount() || deleting) return;
    const example = [...seedClips, ...demoClips].some((x) => x.id === c.id);
    const legacyKey = c._legacyLink || (route.startsWith("/c/") && /^[\w-]{16}$/.test(route.slice(3)) ? route.slice(3) : null);
    if (role === "admin" && !window.confirm(example
      ? "Remove this example from everyone's catalog?"
      : "Delete this clip permanently? Its shared link will stop working.")) return;
    setDeleting(true);
    try {
      if (role === "admin") {
        unwrap(await supabase.rpc("admin_delete_clip", {
          clip_kind: legacyKey ? "legacy" : example ? "example" : "saved",
          clip_key: legacyKey || c.id,
        }));
        if (example) setHiddenExamples((p) => [...p, c.id]);
      } else {
        const deleted = unwrap(await supabase.from("clips").delete().eq("id", c.id).eq("owner_id", session.user.id).select("id"));
        if (!deleted.length) throw new Error("Clip not found or access was revoked.");
      }
      setCustom((p) => p.filter((x) => x.id !== c.id));
      setManagedClips((p) => p.filter((x) => x.id !== c.id && (!legacyKey || x._legacyLink !== legacyKey)));
      setFavorites((p) => p.filter((id) => id !== c.id));
      closePlayer(); setToast(example ? "Example removed from the catalog." : "Clip and its shared link deleted.");
    } catch (e) { setToast("Could not delete clip. " + e.message); }
    finally { setDeleting(false); }
  }
  function navigate(v) {
    setView(v);
    setCategory("All");
    setQuery("");
  }
  function closePlayer() {
    setActive(null);
    setLinkState(null);
    if (location.hash || location.pathname.startsWith("/c/")) {
      history.replaceState(null, "", "/");
      setRoute("/");
    }
  }
  return (
    <>
      <main>
        <header className="top-header">
          <div className="top-header-inner">
            <a
              className="brand"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("discover");
              }}
            >
              <span className="brand-mark">
                <Quote size={23} fill="currentColor" />
              </span>
              clipquote<span className="brand-dot">.</span>
            </a>
            <div className="top-navigation">
              <button className="secondary account-button" disabled={authLoading} onClick={() => setAccountOpen(true)}>
                {authLoading ? "Connecting…" : session ? role === "admin" ? "Admin" : "Account" : "Sign in"}
              </button>
              <nav className="top-nav" aria-label="Main navigation">
                <button
                  className={view === "discover" ? "nav active" : "nav"}
                  onClick={() => navigate("discover")}
                >
                  <Grid2X2 size={19} /> Explore
                </button>
                <button
                  className={view === "favorites" ? "nav active" : "nav"}
                  onClick={() => navigate("favorites")}
                >
                  <Heart size={19} /> Favorites{" "}
                  <small>{favorites.length}</small>
                </button>
                <button
                  className={view === "mine" ? "nav active" : "nav"}
                  onClick={() => navigate("mine")}
                >
                  <Bookmark size={19} /> My clips <small>{custom.length}</small>
                </button>
              </nav>
              <button
                className="theme-toggle"
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
            </div>
          </div>
        </header>
        <div className="content">
          {libraryError && <div className="account-notice" role="alert">{libraryError} <button className="secondary" onClick={() => setLibraryAttempt((n) => n + 1)}>Retry</button></div>}
          {role && legacy.length > 0 && <div className="account-notice">
            {legacy.length} clips are saved in this browser.
            <button className="secondary" disabled={saving} onClick={importLegacy}>{saving ? "Importing…" : "Import to my account"}</button>
          </div>}
          {view === "discover" ? (
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> SMALL CLIPS. BIG FEELINGS.
                </div>
                <h1>
                  Skip the words.
                  <br />
                  <span>Find the scene.</span>
                </h1>
                <p>
                  Iconic quotes, perfect reactions, and those moments
                  <br className="desktop" /> that say more than a thousand
                  messages.
                </p>
                <button className="hero-link" onClick={focusSearch}>
                  Find your reaction <ArrowRight size={17} />
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="spark spark-one">✳</span>
                <span className="spark spark-two">✦</span>
                <div className="scene-stack back" />
                <div className="scene-stack front">
                  <img
                    src="https://i.ytimg.com/vi/31g0YE61PLQ/hqdefault.jpg"
                    alt=""
                  />
                  <div className="scene-shade" />
                  <span className="scene-label">
                    THE OFFICE · MICHAEL SCOTT
                  </span>
                  <div className="scene-quote">
                    “No. God.
                    <br />
                    Please, no!”
                  </div>
                  <div className="scene-bottom">
                    <span>
                      <Play size={12} fill="currentColor" /> 0:08
                    </span>
                    <span>made for Mondays.</span>
                  </div>
                </div>
                <span className="reaction">😅</span>
              </div>
            </section>
          ) : (
            <section className="page-intro">
              <div className="eyebrow">YOUR COLLECTION</div>
              <h1>
                {view === "favorites"
                  ? "Always within reach."
                  : "Your best moments."}
              </h1>
              <p>
                {view === "favorites"
                  ? "All the reactions you want to save for later."
                  : "Your own clips. Ready for the right moment."}
              </p>
            </section>
          )}
          <section className="library">
            <div className="section-heading">
              <div>
                <h2>
                  {view === "discover"
                    ? "For every occasion"
                    : view === "favorites"
                      ? "Favorite clips"
                      : "My clips"}{" "}
                  <span>{filtered.length}</span>
                </h2>
                <p>
                  {view === "discover"
                    ? "Classic scenes + 10 demo cards to explore. Add your own moments."
                    : "Little moments worth keeping."}
                </p>
              </div>
              <div className="library-actions">
                <button className="primary" onClick={openAdd}>
                  <Plus size={17} /> Add clip
                </button>
              </div>
            </div>
            <div className="library-search" ref={librarySearchRef}>
              <div className="search-box">
                <Search size={21} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a quote, movie, or reaction…"
                  aria-label="Search clips"
                />
                {query ? (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </div>
              <div className="filter-sort-row">
                <div className="filters">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={category === c ? "chip selected" : "chip"}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="sort">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Sort clips"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="popular">Recommended</option>
                    <option value="az">Alphabetically</option>
                    <option value="short">Shortest first</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="clip-grid">
              {filtered.map((c, i) => (
                <article
                  className="clip-card"
                  onClick={(e) => {
                    if (!e.target.closest("button, a, input, select")) setActive(c);
                  }}
                  key={c.id}
                  style={{
                    "--card-color": c.color || "#606060",
                    "--delay": `${Math.min(i, 7) * 40}ms`,
                  }}
                >
                  <button
                    className="thumbnail"
                    aria-label={`Play: ${c.title || c.quote}`}
                    onClick={() => setActive(c)}
                  >
                    <VideoThumbnail videoId={c.videoId} alt={`Scene from ${c.source || "YouTube"}`} />
                    <div className="thumb-shade" />
                    <span className="play-circle">
                      <Play size={20} fill="currentColor" />
                    </span>
                  </button>
                  <div className="card-copy">
                    <div className="quote-line">
                      <button
                        onClick={() => setActive(c)}
                        className="quote-title"
                        title={c.title || c.quote}
                      >
                        {c.title || `“${c.quote}”`}
                      </button>
                      <button
                        className={
                          favorites.includes(c.id)
                            ? "icon-button favorited"
                            : "icon-button"
                        }
                        aria-label={`${favorites.includes(c.id) ? "Remove from favorites" : "Add to favorites"}: ${c.title || c.quote}`}
                        onClick={() => favorite(c.id)}
                      >
                        <Heart
                          size={18}
                          fill={
                            favorites.includes(c.id) ? "currentColor" : "none"
                          }
                        />
                      </button>
                    </div>
                    <div className="card-bottom">
                      <button
                        className="tag"
                        onClick={() => setCategory(categoryLabel(c.category))}
                      >
                        {categoryLabel(c.category)}
                      </button>
                      <button
                        className="share-button"
                        disabled={sharing}
                        aria-label={`Share: ${c.title || c.quote}`}
                        onClick={() => share(c)}
                      >
                        <Share2 size={15} />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <div className="empty">
                <Search size={32} />
                <h3>
                  {query
                    ? "No matching scenes."
                    : "Your collection starts here."}
                </h3>
                <p>
                  {query
                    ? "Try another quote or a broader search."
                    : view === "favorites"
                      ? "Tap the heart on a clip to save it here."
                      : "Paste a YouTube link and pick your favorite moment."}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    if (query) {
                      setQuery("");
                      setCategory("All");
                    } else if (view === "favorites") navigate("discover");
                    else openAdd();
                  }}
                >
                  {query
                    ? "Clear filters"
                    : view === "favorites"
                      ? "Explore clips"
                      : "Add clip"}
                </button>
              </div>
            )}
            <div className="bottom-banner">
              <div className="banner-icon">
                <Quote size={23} />
              </div>
              <div>
                <h3>Missing your favorite quote?</h3>
                <p>Paste a link. Pick a moment. Save a reaction.</p>
              </div>
              <button onClick={openAdd}>
                Add your own clip <ArrowUpRight size={17} />
              </button>
            </div>
            <footer>
              <span>
                clipquote. <span>Life has its quotes.</span>
              </span>
              <span>
                Made to be shared <span className="footer-star">✳</span>
              </span>
            </footer>
          </section>
        </div>
      </main>
      {accountOpen && <Modal label="Account" onClose={() => setAccountOpen(false)}>
        <AccountPanel session={session} role={role} onClose={() => setAccountOpen(false)} onError={setToast} />
      </Modal>}
      {adding && (
        <AddModal
          onClose={() => setAdding(false)}
          onSave={async (c) => {
            await saveClip(c);
            setAdding(false); navigate("mine");
            setToast("Clip saved online.");
          }}
        />
      )}
      {linkState && (
        <Modal label="Shared clip" onClose={closePlayer}>
          <h2>{linkState.loading ? "Opening clip…" : "Link unavailable"}</h2>
          <p role={linkState.loading ? "status" : "alert"}>
            {linkState.loading ? "Loading your scene." : linkState.error}
          </p>
          {!linkState.loading && (
            <button
              className="primary"
              onClick={() => setLinkAttempt((n) => n + 1)}
            >
              Try again
            </button>
          )}
        </Modal>
      )}
      {active && (
        <Modal label="Clip player" wide onClose={closePlayer}>
          <ClipPlayer key={active.id} clip={active} />
          <div className="player-info">
            <span className="eyebrow">
              {active._kind === "legacy" ? "Migrated clip" : active.source || "YouTube"} · {time(active.start)}–
              {time(active.end)}
            </span>
            <h2>{active.title || `“${active.quote}”`}</h2>
            {active.title && active.quote && <p>“{active.quote}”</p>}
            <p>
              {[active.speaker, categoryLabel(active.category)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="player-actions">
              <button
                className="primary"
                disabled={sharing}
                onClick={() => share(active)}
              >
                <Share2 size={16} /> {sharing ? "Creating link…" : "Copy link"}
              </button>
              <button className="secondary" onClick={() => favorite(active.id)}>
                <Heart
                  size={16}
                  fill={favorites.includes(active.id) ? "currentColor" : "none"}
                />{" "}
                {favorites.includes(active.id) ? "Saved" : "Favorites"}
              </button>
              {!all.some((c) => c.id === active.id) && (
                <button
                  className="secondary"
                  disabled={saving}
                  onClick={async () => {
                    try { await saveClip(active); setToast("Saved online."); }
                    catch (e) { setToast(e.message); }
                  }}
                >
                  Save clip
                </button>
              )}
              {(role === "admin" || custom.some((c) => c.id === active.id)) && (
                <button
                  className="icon-button"
                  aria-label="Delete clip"
                  disabled={deleting}
                  onClick={() => deleteClip(active)}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <p className="player-hint">
              Video unavailable? The uploader may have disabled embedding.{" "}
              <a
                href={`https://www.youtube.com/watch?v=${active.videoId}&t=${active.start}s`}
                target="_blank"
                rel="noreferrer"
              >
                Open on YouTube ↗
              </a>
            </p>
          </div>
        </Modal>
      )}
      {shareUrl && (
        <Modal label="Share klip" onClose={() => setShareUrl("")}>
          <h2>A link to your scene</h2>
          <p>Copy the link and drop it into a conversation.</p>
          <input
            className="manual-share"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </>
  );
}
function AddModal({ onClose, onSave }) {
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [source, setSource] = useState(""),
    [speaker, setSpeaker] = useState(""),
    [category, setCategory] = useState(categories[1]),
    [tags, setTags] = useState(""),
    [error, setError] = useState(""),
    [editor, setEditor] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [checking, setChecking] = useState(false),
    [playbackStatus, setPlaybackStatus] = useState("pending");
  const id = youtubeId(url),
    a = seconds(start),
    b = seconds(end);
  const rangeValid =
    Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b > a && b <= 86400;
  async function submit(e) {
    e.preventDefault();
    if (!id) return setError("Enter a valid YouTube video link.");
    if (!rangeValid)
      return setError(
        "Choose a valid range: the end must be after the start (max. 24 hours).",
      );
    if (!title.trim()) return setError("Enter a clip title.");
    if (submitting) return;
    setSubmitting(true); setError("");
    try { await onSave({
      id: crypto.randomUUID(),
      videoId: id,
      title: title.trim(),
      start: a,
      end: b,
      quote: "",
      source: source.trim(),
      speaker: speaker.trim(),
      category,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      color: "#707070",
    }); } catch (e) { setError("Could not save online. " + e.message); }
    finally { setSubmitting(false); }
  }
  return (
    <Modal label="Add clip" onClose={onClose}>
      <span className="eyebrow">YOUR SCENE. YOUR WORDS.</span>
      <h2>
        Add a new clip<span className="accent">.</span>
      </h2>
      <p className="form-intro">
        Start with a link. Pick your moment and give it a title.
      </p>
      <form onSubmit={submit}>
        <label>
          YouTube link
          <input
            autoFocus
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => {
              const next = e.target.value;
              if (youtubeId(next) !== id) {
                setChecking(false);
                setPlaybackStatus("pending");
                setStart("");
                setEnd("");
              }
              setUrl(next);
              setError("");
            }}
          />
        </label>
        <small className={id ? "link-status ready" : "link-status"}>
          {id ? (
            <>
              <Check size={13} /> Link ready. Choose your time range.
            </>
          ) : url ? (
            "Paste a valid YouTube video link to unlock the fields."
          ) : (
            "Paste a video link to unlock the other fields."
          )}
        </small>
        {id && (
          <figure className="video-link-preview">
            <VideoThumbnail key={id} videoId={id} alt="YouTube video thumbnail" />
            <figcaption>Video thumbnail from YouTube</figcaption>
          </figure>
        )}
        <label>
          Clip title{" "}
          <input
            required
            disabled={!id}
            maxLength={120}
            placeholder="e.g. When another deadline lands"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <fieldset disabled={!id} className="clip-fields">
          <div className="form-row">
            <label>
              Start
              <input
                required
                value={start}
                onChange={(e) => { setStart(e.target.value); setChecking(false); setPlaybackStatus("pending"); }}
                placeholder="0:00"
              />
            </label>
            <label>
              End
              <input
                required
                value={end}
                onChange={(e) => { setEnd(e.target.value); setChecking(false); setPlaybackStatus("pending"); }}
                placeholder="0:10"
              />
            </label>
            <button
              type="button"
              className="secondary preview-button"
              onClick={() => setEditor(true)}
            >
              <Scissors size={15} /> Choose range
            </button>
          </div>
          <small className="field-hint">
            Enter mm:ss or seconds, or drag the handles on the timeline.
          </small>
          <section className="playback-check" aria-label="Playback check">
            <button type="button" className="secondary" disabled={!rangeValid} onClick={() => setChecking(true)}>
              <Play size={15} /> Check playback
            </button>
            <p className="field-hint">Preview before saving to check whether this video plays in ClipQuote.</p>
            {checking && rangeValid && <>
              <ClipPlayer clip={{ videoId: id, start: a, end: b }} onPlaybackStatus={setPlaybackStatus} />
              <p role="status" className="field-hint">
                {playbackStatus === "passed" ? "Playback works here right now. Availability can change later." :
                 playbackStatus === "failed" ? "Playback check failed. Choose another source, or save this clip with the YouTube fallback." :
                 "Press Play clip to test playback. Loading the player alone does not confirm availability."}
              </p>
            </>}
          </section>
          <label>
            Reaction
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <details className="optional-tags">
            <summary>Additional options</summary>
            <div className="form-row">
              <label>
                Movie, series, or channel
                <input
                  maxLength={100}
                  placeholder="The Office"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
              <label>
                Character / creator{" "}
                <input
                  maxLength={100}
                  placeholder="Michael Scott (optional)"
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
                />
              </label>
            </div>
            <p className="search-hint">
              <Search size={14} /> Search already covers titles, movies, and
              characters. No need to repeat them as tags.
            </p>

            <label>
              Tags
              <input
                maxLength={250}
                placeholder="e.g. Monday, work, nope"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </label>
            <small className="field-hint">
              Add situations or associations, separated by commas.
            </small>
          </details>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span>Your clip will be saved to your account.</span>
          <button disabled={!id || submitting} className="primary" type="submit">
            <Plus size={17} /> {submitting ? "Saving…" : "Save clip"}
          </button>
        </div>
      </form>
      {editor && (
        <RangeModal
          start={a}
          end={b}
          onClose={() => setEditor(false)}
          onApply={(x, y) => {
            setChecking(false);
            setPlaybackStatus("pending");
            setStart(time(x));
            setEnd(time(y));
            setError("");
            setEditor(false);
          }}
        />
      )}
    </Modal>
  );
}
function RangeModal({ start, end, onClose, onApply }) {
  const initialStart =
    Number.isInteger(start) && start >= 0 && start < 86400 ? start : 0;
  const initialEnd =
    Number.isInteger(end) && end > initialStart && end <= 86400
      ? end
      : Math.min(initialStart + 10, 86400);
  const [from, setFrom] = useState(initialStart),
    [to, setTo] = useState(initialEnd),
    [extent, setExtent] = useState(
      String(Math.min(86400, Math.max(300, initialEnd))),
    ),
    [rangeError, setRangeError] = useState("");
  const max = seconds(extent),
    validExtent = Number.isInteger(max) && max >= to && max <= 86400;
  const scale = validExtent ? max : Math.max(300, to);
  return (
    <Modal label="Choose time range" onClose={onClose}>
      <span className="eyebrow">CATCH THAT MOMENT</span>
      <h2>
        Choose range<span className="accent">.</span>
      </h2>
      <p className="form-intro">
        Drag the start and end. Use the arrow keys to adjust by one second.
      </p>
      <div className="range-readout">
        <div>
          <span>Start</span>
          <strong>{time(from)}</strong>
        </div>
        <div className="range-length">
          <Scissors size={18} />
          {to - from} s
        </div>
        <div>
          <span>End</span>
          <strong>{time(to)}</strong>
        </div>
      </div>
      <div
        className="dual-range"
        style={{
          "--from": `${(from / scale) * 100}%`,
          "--to": `${(to / scale) * 100}%`,
        }}
      >
        <div className="range-rail" />
        <div className="range-selection" />
        <input
          type="range"
          aria-label="Range start"
          aria-valuetext={time(from)}
          min="0"
          max={scale}
          step="1"
          value={from}
          onChange={(e) => setFrom(Math.min(Number(e.target.value), to - 1))}
        />
        <input
          type="range"
          aria-label="Range end"
          aria-valuetext={time(to)}
          min="0"
          max={scale}
          step="1"
          value={to}
          onChange={(e) => setTo(Math.max(Number(e.target.value), from + 1))}
        />
      </div>
      <div className="range-ticks">
        <span>0:00</span>
        <span>{time(Math.floor(scale / 2))}</span>
        <span>{time(scale)}</span>
      </div>
      <label className="scale-label">
        Timeline scale
        <input
          value={extent}
          onChange={(e) => {
            setExtent(e.target.value);
            setRangeError("");
          }}
          placeholder="e.g. 5:00"
        />
      </label>
      <p className="field-hint scale-hint">
        This is the selection scale, not the detected video length. Enter a
        larger value for longer videos (max. 24 hours).
      </p>
      {rangeError && (
        <p className="form-error" role="alert">
          {rangeError}
        </p>
      )}
      <div className="range-actions">
        <button className="secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={() => {
            if (!validExtent)
              return setRangeError(
                "The scale must include the selected end and cannot exceed 24 hours.",
              );
            onApply(from, to);
          }}
        >
          <Check size={16} /> Use range
        </button>
      </div>
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(<App />);
