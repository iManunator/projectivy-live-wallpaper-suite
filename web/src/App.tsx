import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { duplicateLayout, emptyLayout, SLOTS, validateLayout, type AppSettings, type CronJob, type Layout } from "./lib/layout";
import type { WallpaperRecord } from "./lib/layout";
import { clampIntensity, defaultDuration, describeMotion, intensityFromPreset, nearestMotionPreset, type MotionStyle } from "./lib/motion";
import { formatOpsTime, LAYOUT_DNA, queueBadges, QUEUE_LABELS, TASTE_PRESETS } from "./lib/queues";
import "./styles/app.css";

type Page = "tonight" | "gallery" | "editor" | "generate" | "dashboard" | "settings";

const SAMPLE: Record<string, string> = {
  title: "Northlight",
  year: "2024",
  genres: "Sci-Fi  ·  Mystery",
  runtime: "2h 11m",
  rating: "8.4",
  overview: "A cartographer maps a city that rearranges itself after dusk.",
  watch_status: "Unwatched",
  source: "Jellyfin",
  age: "PG-13",
};

type MediaRow = {
  title?: string;
  year?: number | null;
  overview?: string;
  rating?: number;
  genres?: string[];
  official_rating?: string;
  runtime?: string;
  watch_state?: string;
  source?: string;
  jellyfin_id?: string | null;
  backdrop_url?: string | null;
  poster_url?: string | null;
};

type ViewerItem = { src: string; title: string; subtitle?: string };

function sampleFromMedia(item: MediaRow): Record<string, string> {
  const genres = (item.genres || []).slice(0, 3).join("  ·  ");
  const watch = (item.watch_state || "").replace(/_/g, " ");
  const watchLabel = watch ? watch.charAt(0).toUpperCase() + watch.slice(1) : "";
  const source = item.source || "jellyfin";
  return {
    title: item.title || "Untitled",
    year: item.year ? String(item.year) : "",
    genres,
    runtime: item.runtime || "",
    rating: item.rating ? Number(item.rating).toFixed(1) : "",
    overview: item.overview || "",
    watch_status: watchLabel,
    source: source.charAt(0).toUpperCase() + source.slice(1),
    age: item.official_rating || "",
  };
}

function wallpaperSlide(item: WallpaperRecord): ViewerItem {
  return {
    src: api.wallpaperImage(item.layout, item.filename),
    title: item.title,
    subtitle: [item.year, item.layout].filter(Boolean).join(" · "),
  };
}

function FullscreenViewer({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: ViewerItem[];
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const item = items[index];
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (!items.length) return;
      if (event.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items, onClose, onIndex]);
  if (!item) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${item.title} full screen`} onClick={onClose}>
      <button type="button" className="lightbox-close btn ghost tiny" onClick={onClose} aria-label="Close full screen">
        Close
      </button>
      {items.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-nav prev btn ghost"
            aria-label="Previous wallpaper"
            onClick={(event) => {
              event.stopPropagation();
              onIndex((index - 1 + items.length) % items.length);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox-nav next btn ghost"
            aria-label="Next wallpaper"
            onClick={(event) => {
              event.stopPropagation();
              onIndex((index + 1) % items.length);
            }}
          >
            ›
          </button>
        </>
      )}
      <figure className="lightbox-frame" onClick={(event) => event.stopPropagation()}>
        <img src={item.src} alt={item.title} />
        <figcaption>
          <strong>{item.title}</strong>
          {item.subtitle ? <span className="muted">{item.subtitle}</span> : null}
        </figcaption>
      </figure>
    </div>
  );
}

const EMPTY_SETTINGS: AppSettings = {
  public_base_url: "http://127.0.0.1:8787",
  timezone: "UTC",
  motion_wallpapers: false,
  motion_quality: "light",
  motion_style: "parallax",
  motion_intensity: 0.55,
  motion_duration: null,
  motion_fps: 24,
  overwrite_existing: false,
  editor_theme: "cinema",
  motion_preset: "cinematic",
  light_leak: true,
  taste_profile: "tonight",
  taste_weights: { unwatched: 50, newly_added: 30, requestable: 20 },
  overlays_enabled: false,
  overlay_clock: true,
  overlays: [],
  jellyfin: {},
  jellyseerr: {},
  tmdb: {},
  cron_jobs: [],
};

const PAGES: Page[] = ["tonight", "gallery", "editor", "generate", "dashboard", "settings"];

export function App() {
  const [page, setPage] = useState<Page>("tonight");
  const [theme, setTheme] = useState("cinema");
  useEffect(() => {
    api
      .settings()
      .then((settings) => setTheme(settings.editor_theme || "cinema"))
      .catch(() => undefined);
  }, []);
  return (
    <div className="app" data-theme={theme}>
      <nav className="nav">
        <h2 className="brand">Wallpaparr</h2>
        <div className="brand-sub">*arr live wallpapers for Projectivy</div>
        {PAGES.map((id) => (
          <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>
            {id === "tonight" ? "Tonight" : id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </nav>
      <main className="main">
        {page === "tonight" && <TonightPage />}
        {page === "gallery" && <GalleryPage onEdit={() => setPage("editor")} />}
        {page === "editor" && <EditorPage />}
        {page === "generate" && <GeneratePage />}
        {page === "dashboard" && <DashboardPage />}
        {page === "settings" && <SettingsPage onTheme={setTheme} />}
      </main>
    </div>
  );
}

type TonightPayload = {
  status: {
    imageUrl?: string | null;
    title?: string | null;
    mediaType?: string;
    videoUrl?: string | null;
    queue?: string | null;
    pinned?: boolean;
    layout?: string | null;
    path?: string | null;
  };
  queues: Array<{ id: string; label: string; count: number; titles: string[] }>;
  profile: string;
  motion: { style?: string; preset?: string; intensity?: number; light_leak?: boolean };
};

function TonightPage() {
  const [layout, setLayout] = useState("Netflix Hero");
  const [layouts, setLayouts] = useState<string[]>([]);
  const [payload, setPayload] = useState<TonightPayload | null>(null);
  const [error, setError] = useState("");
  async function load(nextLayout = layout) {
    try {
      const data = (await api.tonight(nextLayout)) as TonightPayload;
      setPayload(data);
      setError("");
    } catch (err) {
      setError(String(err));
    }
  }
  useEffect(() => {
    api.layouts().then(setLayouts).catch(() => undefined);
  }, []);
  useEffect(() => {
    void load(layout);
  }, [layout]);
  const image = payload?.status?.imageUrl;
  const queueLabel = payload?.status?.queue ? QUEUE_LABELS[payload.status.queue] || payload.status.queue : "Tonight";
  return (
    <section>
      <h1>Tonight’s home screen</h1>
      <p className="lede">
        Preview how Wallpaparr will sit behind Projectivy chrome — clock, rows, and the dock — then one-click a layout DNA preset.
        Smart queues mix unwatched, continue watching, newly added, and Seerr titles from the demo catalog or your library.
      </p>
      <div className="chip-row">
        {LAYOUT_DNA.map((preset) => (
          <button
            key={preset.name}
            className={`chip ${layout === preset.name ? "active" : ""}`}
            onClick={() => setLayout(preset.name)}
            title={preset.blurb}
          >
            {preset.name}
          </button>
        ))}
        {layouts
          .filter((name) => !LAYOUT_DNA.some((preset) => preset.name === name))
          .map((name) => (
            <button key={name} className={`chip ${layout === name ? "active" : ""}`} onClick={() => setLayout(name)}>
              {name}
            </button>
          ))}
        <button className="btn tiny" onClick={() => load(layout)}>
          Shuffle tonight
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="tonight-grid">
        <div className="tv-preview" aria-label="Projectivy home screen preview">
          {image ? <img className="tv-art" src={image} alt={payload?.status?.title || "Wallpaper"} /> : <div className="tv-art tv-art-empty">Generate a batch to fill tonight</div>}
          <div className="tv-chrome">
            <div className="tv-top">
              <span className="tv-logo">projectivy</span>
              <span className="tv-clock">9:41</span>
            </div>
            <div className="tv-hero-meta">
              <span className="badge">{queueLabel}</span>
              {payload?.status?.pinned && <span className="badge">Pinned</span>}
              {payload?.status?.mediaType === "video" && <span className="badge">VIDEO</span>}
              <h2>{payload?.status?.title || "Waiting for a title"}</h2>
              <p>Behind the guide · {layout}</p>
            </div>
            <div className="tv-rows">
              <div className="tv-row-label">Continue watching</div>
              <div className="tv-posters">
                <span /><span /><span /><span /><span />
              </div>
            </div>
            <div className="tv-dock" />
          </div>
        </div>
        <div className="card">
          <h3>Taste · {payload?.profile || "tonight"}</h3>
          <p className="muted">Weighted mix used by pick mode “Tonight’s mix” (`taste:tonight`).</p>
          <ul className="taste-list">
            {Object.entries(TASTE_PRESETS[payload?.profile || "tonight"] || TASTE_PRESETS.tonight).map(([id, weight]) => (
              <li key={id}>
                <strong>{weight}%</strong> {QUEUE_LABELS[id] || id}
              </li>
            ))}
          </ul>
          <p className="muted">
            Motion {payload?.motion?.preset || "cinematic"} · {payload?.motion?.style || "parallax"}
            {payload?.motion?.light_leak ? " · light leak" : ""}
          </p>
        </div>
      </div>
      <div className="queue-grid">
        {(payload?.queues || []).map((queue) => (
          <article className="card queue-card" key={queue.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{queue.label}</strong>
              <span className="badge">{queue.count}</span>
            </div>
            <p className="muted">{queue.titles.join(" · ") || "Empty in this layout"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GalleryPage({ onEdit }: { onEdit: () => void }) {
  const [items, setItems] = useState<WallpaperRecord[]>([]);
  const [error, setError] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  async function refresh() {
    try {
      setItems(await api.gallery());
    } catch (err) {
      setError(String(err));
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  const visible = items.filter((item) => showHidden || !item.hidden);
  const slides = visible.map(wallpaperSlide);
  return (
    <section>
      <h1>Gallery</h1>
      <p className="lede">
        Generated stills and optional parallax VIDEO loops served to Projectivy. Pin a title to keep it in rotation, or mark never-show so it drops out of every queue. Click a still for a full-screen view.
      </p>
      <div className="row" style={{ marginBottom: 18 }}>
        <button className="btn" onClick={onEdit}>Open editor</button>
        <span className="muted">{visible.length} wallpapers</span>
        <label className="inline">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show never-show
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="thumb-grid">
        {visible.map((item, index) => (
          <article className="thumb" key={item.id}>
            <button type="button" className="thumb-hit" onClick={() => setViewer(index)} aria-label={`View ${item.title} full screen`}>
              <img src={api.wallpaperImage(item.layout, item.filename)} alt={item.title} />
            </button>
            <div className="meta">
              <strong>{item.title}</strong>
              <div className="muted">
                {item.year} · {item.layout}
                {item.has_video ? ` · ${item.parallax_style || "motion"}` : ""}
              </div>
              <div>
                {queueBadges(item).map((badge) => (
                  <span className="badge" key={badge}>{badge}</span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  className="btn ghost tiny"
                  onClick={async () => {
                    await api.flag(item.id, { pinned: !item.pinned });
                    refresh();
                  }}
                >
                  {item.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  className="btn ghost tiny"
                  onClick={async () => {
                    await api.flag(item.id, { hidden: !item.hidden });
                    refresh();
                  }}
                >
                  {item.hidden ? "Allow again" : "Never show"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {viewer !== null && (
        <FullscreenViewer items={slides} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />
      )}
    </section>
  );
}

function EditorPage() {
  const [names, setNames] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>(emptyLayout("Netflix Hero"));
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [jellyfin, setJellyfin] = useState<MediaRow[]>([]);
  const [created, setCreated] = useState<WallpaperRecord[]>([]);
  const [previewId, setPreviewId] = useState("");
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    api.layouts().then(async (list) => {
      setNames(list);
      if (list[0]) setLayout(await api.layout(list[0]));
    });
    api
      .media("jellyfin", 16)
      .then((rows) => {
        const usable = (rows as MediaRow[]).filter((row) => row.jellyfin_id && (row.backdrop_url || row.poster_url));
        setJellyfin(usable);
        if (usable[0]?.jellyfin_id) setPreviewId(String(usable[0].jellyfin_id));
      })
      .catch(() => setJellyfin([]));
  }, []);

  useEffect(() => {
    api.gallery(layout.name).then(setCreated).catch(() => setCreated([]));
  }, [layout.name]);

  const errors = useMemo(() => validateLayout(layout), [layout]);
  const layer = layout.layers[selected];
  const preview = jellyfin.find((row) => String(row.jellyfin_id) === previewId) || jellyfin[0];
  const sample = preview ? sampleFromMedia(preview) : SAMPLE;
  const artSrc = preview?.jellyfin_id ? api.mediaArtwork(String(preview.jellyfin_id)) : "";
  const createdSlides = created.map(wallpaperSlide);
  const fadeStyle = artSrc
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(5,5,5,0.88) 0%, rgba(5,5,5,0.35) ${Math.round(layout.background.fade_left * 100)}%, transparent ${Math.round((layout.background.fade_left + 0.18) * 100)}%), linear-gradient(0deg, rgba(5,5,5,0.72) 0%, transparent ${Math.round(layout.background.fade_bottom * 100)}%)`,
      }
    : undefined;

  async function load(name: string) {
    setLayout(await api.layout(name));
    setSelected(0);
  }

  async function save() {
    setError("");
    if (errors.length) {
      setError(errors.join(" · "));
      return;
    }
    await api.saveLayout(layout);
    setNames(await api.layouts());
    setStatus(`Saved “${layout.name}”`);
  }

  return (
    <section>
      <h1>Layout editor</h1>
      <p className="lede">WYSIWYG-style chrome over a 16:9 stage. Layout DNA presets keep metadata in Projectivy-safe zones. When Jellyfin is connected, the stage uses a real library backdrop.</p>
      <div className="grid two">
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <select value={layout.name} onChange={(e) => load(e.target.value)} aria-label="Layout">
              {names.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <button className="btn ghost tiny" onClick={() => setLayout(duplicateLayout(layout, `${layout.name} copy`))}>
              Duplicate
            </button>
            <button className="btn tiny" onClick={save}>Save layout</button>
          </div>
          {jellyfin.length > 0 && (
            <>
              <label>Jellyfin preview</label>
              <select value={previewId} onChange={(e) => setPreviewId(e.target.value)} aria-label="Jellyfin preview">
                {jellyfin.map((item) => (
                  <option key={String(item.jellyfin_id)} value={String(item.jellyfin_id)}>
                    {item.title}
                    {item.year ? ` (${item.year})` : ""}
                  </option>
                ))}
              </select>
            </>
          )}
          {jellyfin.length === 0 && (
            <p className="muted">No Jellyfin artwork yet — connect Jellyfin in Settings, or keep editing on the sample stage.</p>
          )}
          <label>Layout name</label>
          <input value={layout.name} onChange={(e) => setLayout({ ...layout, name: e.target.value })} />
          <div className="canvas-wrap" style={{ marginTop: 14 }}>
            {artSrc && <img className="canvas-art" src={artSrc} alt={`${preview?.title || "Library"} artwork`} />}
            <div className={`canvas-stage ${artSrc ? "has-art" : ""}`} style={fadeStyle}>
              {layout.layers.filter((l) => l.visible).map((l) => (
                <div
                  key={l.id}
                  className="layer-chip"
                  style={{
                    left: `${(l.x / layout.canvas_width) * 100}%`,
                    top: `${(l.y / layout.canvas_height) * 100}%`,
                    fontSize: Math.max(10, l.font_size * 0.35),
                    fontWeight: l.font_weight === "bold" ? 700 : 500,
                    color: l.color,
                    maxWidth: l.width ? `${(l.width / layout.canvas_width) * 100}%` : undefined,
                    whiteSpace: l.slot === "overview" ? "normal" : "nowrap",
                  }}
                >
                  {sample[l.slot] || l.slot}
                </div>
              ))}
            </div>
          </div>
          {created.length > 0 && (
            <div className="created-strip">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Generated for this layout</strong>
                <span className="muted">{created.length} stills · click for full screen</span>
              </div>
              <div className="created-row">
                {created.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className="created-thumb"
                    onClick={() => setViewer(index)}
                    aria-label={`View ${item.title} full screen`}
                  >
                    <img src={api.wallpaperImage(item.layout, item.filename)} alt={item.title} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {status && <p className="status">{status}</p>}
          {error && <p className="error">{error}</p>}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>Layers</strong>
            <button
              className="btn ghost tiny"
              onClick={() =>
                setLayout({
                  ...layout,
                  layers: [
                    ...layout.layers,
                    {
                      id: `layer-${layout.layers.length + 1}`,
                      slot: "year",
                      x: 80,
                      y: 200,
                      font_size: 24,
                      color: "#ffffff",
                      font_weight: "regular",
                      visible: true,
                      align: "left",
                    },
                  ],
                })
              }
            >
              Add layer
            </button>
          </div>
          <div className="layer-list" style={{ marginTop: 10 }}>
            {layout.layers.map((item, index) => (
              <button
                key={item.id}
                className={`layer-item ${index === selected ? "selected" : ""}`}
                onClick={() => setSelected(index)}
              >
                {item.id} · {item.slot}
              </button>
            ))}
          </div>
          {layer && (
            <div className="grid" style={{ marginTop: 14 }}>
              <label>Slot</label>
              <select
                value={layer.slot}
                onChange={(e) => {
                  const layers = layout.layers.slice();
                  layers[selected] = { ...layer, slot: e.target.value };
                  setLayout({ ...layout, layers });
                }}
              >
                {SLOTS.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
              <div className="row">
                <div>
                  <label>X</label>
                  <input
                    type="number"
                    value={layer.x}
                    onChange={(e) => {
                      const layers = layout.layers.slice();
                      layers[selected] = { ...layer, x: Number(e.target.value) };
                      setLayout({ ...layout, layers });
                    }}
                  />
                </div>
                <div>
                  <label>Y</label>
                  <input
                    type="number"
                    value={layer.y}
                    onChange={(e) => {
                      const layers = layout.layers.slice();
                      layers[selected] = { ...layer, y: Number(e.target.value) };
                      setLayout({ ...layout, layers });
                    }}
                  />
                </div>
                <div>
                  <label>Size</label>
                  <input
                    type="number"
                    value={layer.font_size}
                    onChange={(e) => {
                      const layers = layout.layers.slice();
                      layers[selected] = { ...layer, font_size: Number(e.target.value) };
                      setLayout({ ...layout, layers });
                    }}
                  />
                </div>
              </div>
              <label>Fade left / bottom</label>
              <div className="row">
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.01}
                  value={layout.background.fade_left}
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      background: { ...layout.background, fade_left: Number(e.target.value) },
                    })
                  }
                />
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.01}
                  value={layout.background.fade_bottom}
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      background: { ...layout.background, fade_bottom: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {viewer !== null && (
        <FullscreenViewer items={createdSlides} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />
      )}
    </section>
  );
}

function csvToIds(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function GeneratePage() {
  const [layouts, setLayouts] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [form, setForm] = useState({
    layout: "Netflix Hero",
    source: "demo",
    limit: 8,
    skip_existing: true,
    replace_existing: false,
    cleanup: false,
    motion: false,
    ids: "",
    skip_ids: "",
  });
  const [result, setResult] = useState("");
  useEffect(() => {
    api.layouts().then((names) => {
      setLayouts(names);
      if (names[0]) setForm((f) => ({ ...f, layout: names[0] }));
    });
    api.settings().then(setSettings).catch(() => undefined);
  }, []);
  const style = (settings?.motion_style || "parallax") as MotionStyle;
  const intensity = intensityFromPreset(settings?.motion_preset) || clampIntensity(settings?.motion_intensity ?? 0.55);
  const duration = settings?.motion_duration || defaultDuration(settings?.motion_quality || "light");
  return (
    <section>
      <h1>Generate</h1>
      <p className="lede">
        Batch cinematic stills from Jellyfin, Jellyseerr, or the built-in demo catalog. Skip already-rendered titles by Jellyfin / TMDB / IMDb id, replace them in place, or bake optional parallax VIDEO loops for Projectivy.
      </p>
      <div className="card" style={{ maxWidth: 720 }}>
        <label>Layout / collection</label>
        <select value={form.layout} onChange={(e) => setForm({ ...form, layout: e.target.value })}>
          {layouts.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <label style={{ marginTop: 12 }}>Source</label>
        <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
          <option value="demo">Demo catalog</option>
          <option value="jellyfin">Jellyfin</option>
          <option value="jellyseerr">Jellyseerr / Seerr</option>
          <option value="all">All configured</option>
        </select>
        <label style={{ marginTop: 12 }}>Limit</label>
        <input
          type="number"
          value={form.limit}
          onChange={(e) => setForm({ ...form, limit: Number(e.target.value) })}
        />
        <label style={{ marginTop: 12 }}>Only these media ids (Jellyfin / TMDB / IMDb, comma-separated)</label>
        <input value={form.ids} onChange={(e) => setForm({ ...form, ids: e.target.value })} placeholder="demo-jf-1, 90001, tt123" />
        <label style={{ marginTop: 12 }}>Skip these media ids</label>
        <input value={form.skip_ids} onChange={(e) => setForm({ ...form, skip_ids: e.target.value })} placeholder="leave blank to skip none extra" />
        <label style={{ marginTop: 12 }}><input type="checkbox" checked={form.skip_existing} onChange={(e) => setForm({ ...form, skip_existing: e.target.checked })} /> Skip titles already generated (IMDb / TMDB / Jellyfin id)</label>
        <label><input type="checkbox" checked={form.replace_existing} onChange={(e) => setForm({ ...form, replace_existing: e.target.checked })} /> Replace / overwrite same show</label>
        <label><input type="checkbox" checked={form.cleanup} onChange={(e) => setForm({ ...form, cleanup: e.target.checked })} /> Cleanup titles no longer in the source list</label>
        <label><input type="checkbox" checked={form.motion} onChange={(e) => setForm({ ...form, motion: e.target.checked })} /> Bake parallax / motion VIDEO (ffmpeg)</label>
        <p className="muted">{describeMotion(style, intensity, duration)}. Stills always remain; the plugin prefers VIDEO when this is enabled. Intensity preset: {settings?.motion_preset || "cinematic"}{settings?.light_leak ? " · light leak" : ""}.</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn"
            onClick={async () => {
              const out = await api.generate({
                layout: form.layout,
                source: form.source,
                limit: form.limit,
                skip_existing: form.skip_existing,
                replace_existing: form.replace_existing,
                cleanup: form.cleanup,
                motion: form.motion,
                ids: csvToIds(form.ids),
                skip_ids: csvToIds(form.skip_ids),
              });
              setResult(JSON.stringify(out, null, 2));
            }}
          >
            Run batch
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              const out = await api.generateMotion(form.layout);
              setResult(JSON.stringify(out, null, 2));
            }}
          >
            Re-bake motion for layout
          </button>
        </div>
        {result && <pre className="muted">{result}</pre>}
      </div>
    </section>
  );
}

function DashboardPage() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.dashboard().then(setData).catch((err) => setError(String(err)));
  }, []);
  if (!data) return <p>{error || "Loading…"}</p>;
  const gallery = data.gallery || {};
  const cron = data.cron || {};
  const providers = data.providers || {};
  return (
    <section>
      <h1>Health</h1>
      <p className="lede">Last cron, gallery size, motion preset, and whether Jellyfin / Seerr keys are configured. Demo mode is always healthy.</p>
      {error && <p className="error">{error}</p>}
      <div className="dash-grid">
        <article className="card">
          <h3>Gallery</h3>
          <p className="dash-stat">{gallery.count ?? 0}</p>
          <p className="muted">{gallery.videos ?? 0} VIDEO · {gallery.pinned ?? 0} pinned · {gallery.hidden ?? 0} never-show</p>
        </article>
        <article className="card">
          <h3>Cron</h3>
          <p className="dash-stat">{formatOpsTime(cron.last?.at)}</p>
          <p className="muted">{cron.jobs ?? 0} jobs · last generate {formatOpsTime(cron.last_generate?.at)}</p>
        </article>
        <article className="card">
          <h3>Motion</h3>
          <p className="dash-stat">{data.motion?.preset || "cinematic"}</p>
          <p className="muted">{data.motion?.style} · {data.motion?.quality}{data.motion?.light_leak ? " · leak" : ""}</p>
        </article>
        <article className="card">
          <h3>Taste</h3>
          <p className="dash-stat">{data.taste?.profile || "tonight"}</p>
          <p className="muted">Plugin pick mode “Tonight’s mix” uses this profile.</p>
        </article>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        {["jellyfin", "jellyseerr", "tmdb", "demo"].map((name) => {
          const row = providers[name] || {};
          return (
            <article className="card" key={name}>
              <h3>{name}</h3>
              <p>{row.configured ? "Configured" : "Not configured"}</p>
              <p className="muted">Last test {formatOpsTime(row.last_test?.at)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SettingsPage({ onTheme }: { onTheme: (theme: string) => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api.settings().then((loaded) => setSettings({ ...EMPTY_SETTINGS, ...loaded })).catch(() => setSettings(EMPTY_SETTINGS));
  }, []);
  if (!settings) return <p>Loading…</p>;
  function patch(section: "jellyfin" | "jellyseerr" | "tmdb", key: string, value: string) {
    setSettings({
      ...settings!,
      [section]: { ...(settings![section] || {}), [key]: value },
    });
  }
  const cron: CronJob = settings.cron_jobs[0] || {
    enabled: false,
    cron: "0 4 * * *",
    layout: "Netflix Hero",
    source: "jellyfin",
    skip_existing: true,
    replace_existing: false,
    cleanup: true,
    motion: false,
    limit: 20,
    ids: [],
    skip_ids: [],
  };
  function setCron(next: CronJob) {
    setSettings({ ...settings!, cron_jobs: [next] });
  }
  const preset = settings.motion_preset || nearestMotionPreset(settings.motion_intensity);
  const intensity = intensityFromPreset(preset);
  const duration = Number(settings.motion_duration || defaultDuration(settings.motion_quality));
  const style = (settings.motion_style || "parallax") as MotionStyle;
  const weights = settings.taste_weights || TASTE_PRESETS[settings.taste_profile || "tonight"];
  return (
    <section>
      <h1>Settings</h1>
      <p className="lede">Provider keys stay in config.json on the server. This form never commits secrets. Plugin pick modes, filters, and VIDEO preference live on the TV; generation, taste, motion presets, and overlay hooks live here.</p>
      <div className="grid two">
        <div className="card">
          <h3>Serving</h3>
          <label>Public base URL (what the TV plugin should use)</label>
          <input
            value={settings.public_base_url}
            onChange={(e) => setSettings({ ...settings, public_base_url: e.target.value })}
            placeholder="http://192.168.1.10:8787"
          />
          <label>Timezone</label>
          <input value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
        </div>
        <div className="card">
          <h3>Parallax / live motion</h3>
          <label>
            <input
              type="checkbox"
              checked={settings.motion_wallpapers}
              onChange={(e) => setSettings({ ...settings, motion_wallpapers: e.target.checked })}
            />{" "}
            Generate VIDEO loops by default (still IMAGE is always kept)
          </label>
          <label>Motion style</label>
          <select value={settings.motion_style || "parallax"} onChange={(e) => setSettings({ ...settings, motion_style: e.target.value })}>
            <option value="parallax">Parallax — artwork drifts, chrome stays</option>
            <option value="kenburns">Ken Burns — single-layer zoom</option>
            <option value="drift">Drift — slow pan, tiny zoom</option>
          </select>
          <label>Intensity preset</label>
          <select
            value={preset}
            onChange={(e) =>
              setSettings({
                ...settings,
                motion_preset: e.target.value,
                motion_intensity: intensityFromPreset(e.target.value),
              })
            }
          >
            <option value="subtle">Subtle</option>
            <option value="cinematic">Cinematic</option>
            <option value="bold">Bold</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.light_leak)}
              onChange={(e) => setSettings({ ...settings, light_leak: e.target.checked })}
            />{" "}
            Light-leak layer on parallax VIDEO
          </label>
          <label>Quality</label>
          <select value={settings.motion_quality} onChange={(e) => setSettings({ ...settings, motion_quality: e.target.value })}>
            <option value="light">light (~6s, 2.2 Mbps)</option>
            <option value="standard">standard (~8s, 3.5 Mbps)</option>
            <option value="cinematic">cinematic (~10s, 5 Mbps)</option>
          </select>
          <label>Loop duration seconds (blank = quality default)</label>
          <input
            type="number"
            min={2}
            max={20}
            value={settings.motion_duration ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                motion_duration: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          <label>FPS</label>
          <input
            type="number"
            min={12}
            max={30}
            value={settings.motion_fps || 24}
            onChange={(e) => setSettings({ ...settings, motion_fps: Number(e.target.value) })}
          />
          <p className="muted">{describeMotion(style, intensity, duration)}</p>
        </div>
        <div className="card">
          <h3>Taste profile</h3>
          <label>Profile (plugin pick mode “Tonight’s mix”)</label>
          <select
            value={settings.taste_profile || "tonight"}
            onChange={(e) =>
              setSettings({
                ...settings,
                taste_profile: e.target.value,
                taste_weights: TASTE_PRESETS[e.target.value] || settings.taste_weights,
              })
            }
          >
            {Object.keys(TASTE_PRESETS).map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          {Object.entries(weights || {}).map(([id, weight]) => (
            <div key={id}>
              <label>{QUEUE_LABELS[id] || id} ({weight}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={weight}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    taste_weights: { ...weights, [id]: Number(e.target.value) },
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Overlay widgets</h3>
          <p className="muted">Off by default. Clock is a local demo widget; HA / news / JSON are documented hooks that render fixture cards so offline tests stay green.</p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.overlays_enabled)}
              onChange={(e) => setSettings({ ...settings, overlays_enabled: e.target.checked })}
            />{" "}
            Enable overlay widgets on generated stills / chrome
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.overlay_clock)}
              onChange={(e) => setSettings({ ...settings, overlay_clock: e.target.checked })}
            />{" "}
            Clock card
          </label>
        </div>
        <div className="card">
          <h3>Editor appearance</h3>
          <label>Theme</label>
          <select
            value={settings.editor_theme || "cinema"}
            onChange={(e) => {
              setSettings({ ...settings, editor_theme: e.target.value });
              onTheme(e.target.value);
            }}
          >
            <option value="cinema">Cinema</option>
            <option value="midnight">Midnight</option>
            <option value="studio">Studio</option>
            <option value="high-contrast">High contrast</option>
          </select>
        </div>
        <div className="card">
          <h3>Jellyfin</h3>
          <label>URL</label>
          <input value={settings.jellyfin.url || ""} onChange={(e) => patch("jellyfin", "url", e.target.value)} placeholder="http://192.168.1.10:8096" />
          <label>API key</label>
          <input value={settings.jellyfin.api_key || ""} onChange={(e) => patch("jellyfin", "api_key", e.target.value)} />
          <label>User id (optional)</label>
          <input value={settings.jellyfin.user_id || ""} onChange={(e) => patch("jellyfin", "user_id", e.target.value)} />
          <button className="btn ghost tiny" style={{ marginTop: 10 }} onClick={async () => setMsg(JSON.stringify(await api.testProvider("jellyfin")))}>Test Jellyfin</button>
        </div>
        <div className="card">
          <h3>Jellyseerr / Seerr</h3>
          <label>URL</label>
          <input value={settings.jellyseerr.url || ""} onChange={(e) => patch("jellyseerr", "url", e.target.value)} placeholder="http://192.168.1.10:5055" />
          <label>API key</label>
          <input value={settings.jellyseerr.api_key || ""} onChange={(e) => patch("jellyseerr", "api_key", e.target.value)} />
          <button className="btn ghost tiny" style={{ marginTop: 10 }} onClick={async () => setMsg(JSON.stringify(await api.testProvider("jellyseerr")))}>Test Seerr</button>
        </div>
        <div className="card">
          <h3>TMDB (optional enrichment)</h3>
          <label>API key</label>
          <input value={settings.tmdb.api_key || ""} onChange={(e) => patch("tmdb", "api_key", e.target.value)} />
          <label>Language</label>
          <input value={settings.tmdb.language || "en-US"} onChange={(e) => patch("tmdb", "language", e.target.value)} />
          <button className="btn ghost tiny" style={{ marginTop: 10 }} onClick={async () => setMsg(JSON.stringify(await api.testProvider("tmdb")))}>Test TMDB</button>
        </div>
        <div className="card">
          <h3>Cron / batch</h3>
          <label>
            <input
              type="checkbox"
              checked={Boolean(cron.enabled)}
              onChange={(e) => setCron({ ...cron, enabled: e.target.checked })}
            />{" "}
            Enable scheduled generate
          </label>
          <label>Cron (5-field expression)</label>
          <input value={String(cron.cron || "")} onChange={(e) => setCron({ ...cron, cron: e.target.value })} placeholder="0 4 * * *" />
          <label>Layout</label>
          <input value={String(cron.layout || "")} onChange={(e) => setCron({ ...cron, layout: e.target.value })} />
          <label>Source</label>
          <select value={String(cron.source || "jellyfin")} onChange={(e) => setCron({ ...cron, source: e.target.value })}>
            <option value="demo">demo</option>
            <option value="jellyfin">jellyfin</option>
            <option value="jellyseerr">jellyseerr</option>
            <option value="all">all</option>
          </select>
          <label>Limit</label>
          <input type="number" value={Number(cron.limit || 20)} onChange={(e) => setCron({ ...cron, limit: Number(e.target.value) })} />
          <label>Only ids (comma)</label>
          <input
            value={Array.isArray(cron.ids) ? cron.ids.join(",") : String(cron.ids || "")}
            onChange={(e) => setCron({ ...cron, ids: csvToIds(e.target.value) })}
          />
          <label>Skip ids (comma)</label>
          <input
            value={Array.isArray(cron.skip_ids) ? cron.skip_ids.join(",") : String(cron.skip_ids || "")}
            onChange={(e) => setCron({ ...cron, skip_ids: csvToIds(e.target.value) })}
          />
          <label><input type="checkbox" checked={Boolean(cron.skip_existing)} onChange={(e) => setCron({ ...cron, skip_existing: e.target.checked })} /> Skip existing by media id</label>
          <label><input type="checkbox" checked={Boolean(cron.replace_existing)} onChange={(e) => setCron({ ...cron, replace_existing: e.target.checked })} /> Overwrite / replace</label>
          <label><input type="checkbox" checked={Boolean(cron.cleanup)} onChange={(e) => setCron({ ...cron, cleanup: e.target.checked })} /> Cleanup missing titles</label>
          <label><input type="checkbox" checked={Boolean(cron.motion)} onChange={(e) => setCron({ ...cron, motion: e.target.checked })} /> Bake parallax VIDEO</label>
        </div>
      </div>
      <button
        className="btn"
        style={{ marginTop: 18 }}
        onClick={async () => {
          await api.saveSettings(settings);
          setMsg("Saved");
          onTheme(settings.editor_theme || "cinema");
        }}
      >
        Save settings
      </button>
      {msg && <p className="status">{msg}</p>}
    </section>
  );
}
