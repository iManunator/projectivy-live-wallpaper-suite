import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { duplicateLayout, emptyLayout, SLOTS, validateLayout, type Layout } from "./lib/layout";
import type { AppSettings, WallpaperRecord } from "./lib/layout";
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

export function App() {
  const [page, setPage] = useState<Page>("gallery");
  return (
    <div className="app">
      <nav className="nav">
        <h2 className="brand">Live Wallpaper Suite</h2>
        <div className="brand-sub">Projectivy · cinematic stills & motion</div>
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
        {page === "settings" && <SettingsPage />}
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
      <p className="lede">Generated stills served to Projectivy. Open the editor to restyle a layout, or generate a fresh batch.</p>
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
                {item.has_video ? " · motion" : ""}
              </div>
              <div>
                <span className="badge">{item.source}</span>
                <span className="badge">{item.watch_state || "—"}</span>
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
      <p className="lede">WYSIWYG-style chrome over a 16:9 stage. Slots bind to media metadata at generate time.</p>
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

function GeneratePage() {
  const [layouts, setLayouts] = useState<string[]>([]);
  const [form, setForm] = useState({
    layout: "Netflix Hero",
    source: "demo",
    limit: 8,
    skip_existing: true,
    replace_existing: false,
    cleanup: false,
    motion: false,
  });
  const [result, setResult] = useState("");
  useEffect(() => {
    api.layouts().then((names) => {
      setLayouts(names);
      if (names[0]) setForm((f) => ({ ...f, layout: names[0] }));
    });
  }, []);
  return (
    <section>
      <h1>Generate</h1>
      <p className="lede">
        Batch cinematic stills from Jellyfin, Jellyseerr, or the built-in demo catalog. Skip already-rendered titles by media id, or replace them in place.
      </p>
      <div className="card" style={{ maxWidth: 640 }}>
        <label>Layout</label>
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
        <label style={{ marginTop: 12 }}><input type="checkbox" checked={form.skip_existing} onChange={(e) => setForm({ ...form, skip_existing: e.target.checked })} /> Skip titles already generated (IMDb / TMDB / Jellyfin id)</label>
        <label><input type="checkbox" checked={form.replace_existing} onChange={(e) => setForm({ ...form, replace_existing: e.target.checked })} /> Replace / overwrite same show</label>
        <label><input type="checkbox" checked={form.cleanup} onChange={(e) => setForm({ ...form, cleanup: e.target.checked })} /> Cleanup titles no longer in the source list</label>
        <label><input type="checkbox" checked={form.motion} onChange={(e) => setForm({ ...form, motion: e.target.checked })} /> Bake Ken Burns MP4 loops</label>
        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn"
            onClick={async () => {
              const out = await api.generate(form);
              setResult(JSON.stringify(out, null, 2));
            }}
          >
            Run batch
          </button>
        </div>
        {result && <pre className="muted">{result}</pre>}
      </div>
    </section>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api.settings().then(setSettings);
  }, []);
  if (!settings) return <p>Loading…</p>;
  function patch(section: "jellyfin" | "jellyseerr" | "tmdb", key: string, value: string) {
    setSettings({
      ...settings!,
      [section]: { ...(settings![section] || {}), [key]: value },
    });
  }
  return (
    <section>
      <h1>Settings</h1>
      <p className="lede">Provider keys stay in config.json on the server. This form never commits secrets.</p>
      <div className="grid two">
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
        </div>
        <div className="card">
          <h3>Serving & motion</h3>
          <label>Public base URL (what the TV plugin should use)</label>
          <input
            value={settings.public_base_url}
            onChange={(e) => setSettings({ ...settings, public_base_url: e.target.value })}
            placeholder="http://192.168.1.10:8787"
          />
          <label><input type="checkbox" checked={settings.motion_wallpapers} onChange={(e) => setSettings({ ...settings, motion_wallpapers: e.target.checked })} /> Generate motion loops by default</label>
          <label>Motion quality</label>
          <select value={settings.motion_quality} onChange={(e) => setSettings({ ...settings, motion_quality: e.target.value })}>
            <option value="light">light</option>
            <option value="standard">standard</option>
          </select>
          <label>Cron (5-field expression)</label>
          <input
            value={String(settings.cron_jobs[0]?.cron || "")}
            onChange={(e) =>
              setSettings({
                ...settings,
                cron_jobs: [{ enabled: true, cron: e.target.value, layout: "Netflix Hero", source: "jellyfin", skip_existing: true, limit: 20 }],
              })
            }
            placeholder="0 4 * * *"
          />
          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={async () => {
              await api.saveSettings(settings);
              setMsg("Saved");
            }}
          >
            Save settings
          </button>
        </div>
      </div>
      {msg && <p className="status">{msg}</p>}
    </section>
  );
}
