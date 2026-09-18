import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { duplicateLayout, emptyLayout, SLOTS, validateLayout, type AppSettings, type CronJob, type Layout } from "./lib/layout";
import type { WallpaperRecord } from "./lib/layout";
import { clampIntensity, defaultDuration, describeMotion, type MotionStyle } from "./lib/motion";
import "./styles/app.css";

type Page = "gallery" | "editor" | "generate" | "settings";

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
  jellyfin: {},
  jellyseerr: {},
  tmdb: {},
  cron_jobs: [],
};

export function App() {
  const [page, setPage] = useState<Page>("gallery");
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
        <div className="brand-sub">Projectivy · cinematic stills & parallax</div>
        {(["gallery", "editor", "generate", "settings"] as Page[]).map((id) => (
          <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </nav>
      <main className="main">
        {page === "gallery" && <GalleryPage onEdit={() => setPage("editor")} />}
        {page === "editor" && <EditorPage />}
        {page === "generate" && <GeneratePage />}
        {page === "settings" && <SettingsPage onTheme={setTheme} />}
      </main>
    </div>
  );
}

function GalleryPage({ onEdit }: { onEdit: () => void }) {
  const [items, setItems] = useState<WallpaperRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api.gallery().then(setItems).catch((err) => setError(String(err)));
  }, []);
  return (
    <section>
      <h1>Gallery</h1>
      <p className="lede">
        Generated stills and optional parallax VIDEO loops served to Projectivy. Open the editor to restyle a layout, or generate a fresh batch.
      </p>
      <div className="row" style={{ marginBottom: 18 }}>
        <button className="btn" onClick={onEdit}>Open editor</button>
        <span className="muted">{items.length} wallpapers</span>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="thumb-grid">
        {items.map((item) => (
          <article className="thumb" key={item.id}>
            <img src={api.wallpaperImage(item.layout, item.filename)} alt={item.title} />
            <div className="meta">
              <strong>{item.title}</strong>
              <div className="muted">
                {item.year} · {item.layout}
                {item.has_video ? ` · ${item.parallax_style || "motion"}` : ""}
              </div>
              <div>
                <span className="badge">{item.source}</span>
                <span className="badge">{item.watch_state || "—"}</span>
                {item.has_video && <span className="badge">VIDEO</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EditorPage() {
  const [names, setNames] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>(emptyLayout("Netflix Hero"));
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.layouts().then(async (list) => {
      setNames(list);
      if (list[0]) setLayout(await api.layout(list[0]));
    });
  }, []);

  const errors = useMemo(() => validateLayout(layout), [layout]);
  const layer = layout.layers[selected];

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
      <p className="lede">WYSIWYG-style chrome over a 16:9 stage. Slots bind to media metadata at generate time. Parallax VIDEO keeps this chrome nearly still while the artwork drifts.</p>
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
          <label>Layout name</label>
          <input value={layout.name} onChange={(e) => setLayout({ ...layout, name: e.target.value })} />
          <div className="canvas-wrap" style={{ marginTop: 14 }}>
            <div className="canvas-stage">
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
                  {SAMPLE[l.slot] || l.slot}
                </div>
              ))}
            </div>
          </div>
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
  const intensity = clampIntensity(settings?.motion_intensity ?? 0.55);
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
        <p className="muted">{describeMotion(style, intensity, duration)}. Stills always remain; the plugin prefers VIDEO when this is enabled.</p>
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
  const style = (settings.motion_style || "parallax") as MotionStyle;
  const intensity = clampIntensity(Number(settings.motion_intensity ?? 0.55));
  const duration = Number(settings.motion_duration || defaultDuration(settings.motion_quality));
  return (
    <section>
      <h1>Settings</h1>
      <p className="lede">Provider keys stay in config.json on the server. This form never commits secrets. Plugin pick modes, filters, and VIDEO preference live on the TV; generation/motion defaults live here.</p>
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
          <label>Quality</label>
          <select value={settings.motion_quality} onChange={(e) => setSettings({ ...settings, motion_quality: e.target.value })}>
            <option value="light">light (~6s, 2.2 Mbps)</option>
            <option value="standard">standard (~8s, 3.5 Mbps)</option>
            <option value="cinematic">cinematic (~10s, 5 Mbps)</option>
          </select>
          <label>Intensity ({intensity.toFixed(2)})</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={intensity}
            onChange={(e) => setSettings({ ...settings, motion_intensity: clampIntensity(Number(e.target.value)) })}
          />
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
