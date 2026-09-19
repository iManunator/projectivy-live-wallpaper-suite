import { useEffect, useState, type CSSProperties } from "react";
import { EditorPage } from "./EditorPage";
import { GalleryPage } from "./GalleryPage";
import { api } from "./lib/api";
import { type AppSettings, type CronJob } from "./lib/layout";
import { describeBatchFlags } from "./lib/batch";
import { errorToast, providerToast } from "./lib/messages";
import { clampIntensity, defaultDuration, describeMotion, intensityFromPreset, motionPreviewVars, nearestMotionPreset, PRESET_DURATION, type MotionStyle } from "./lib/motion";
import { formatOpsTime, LAYOUT_DNA, QUEUE_LABELS, TASTE_PRESETS } from "./lib/queues";
import { ChromePills } from "./ChromePills";
import { SampleLockedChrome, WallpaperStage } from "./WallpaperStage";
import { JobProgress, JobProvider, useJobs } from "./JobProgress";
import { ToastProvider, useToasts } from "./toasts";
import "./styles/app.css";

type Page = "tonight" | "gallery" | "editor" | "generate" | "dashboard" | "settings";

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
  title_display: "auto",
  jellyfin: {},
  jellyseerr: {},
  tmdb: {},
  cron_jobs: [],
};

const PAGES: Page[] = ["tonight", "gallery", "editor", "generate", "dashboard", "settings"];

export function App() {
  return (
    <ToastProvider>
      <JobProvider>
        <AppShell />
      </JobProvider>
    </ToastProvider>
  );
}

function AppShell() {
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
        <JobProgress />
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
    watchState?: string | null;
    libraryState?: string | null;
    availability?: string | null;
    seerrStatus?: string | null;
    source?: string | null;
  };
  queues: Array<{ id: string; label: string; count: number; titles: string[] }>;
  profile: string;
  motion: { style?: string; preset?: string; intensity?: number; light_leak?: boolean };
  preview?: { artworkUrl?: string | null; itemId?: string | null; layered?: boolean };
};

function TonightPage() {
  const notify = useToasts();
  const { run, busy } = useJobs();
  const [layout, setLayout] = useState("Netflix Hero");
  const [layouts, setLayouts] = useState<string[]>([]);
  const [payload, setPayload] = useState<TonightPayload | null>(null);
  const [error, setError] = useState("");
  const [previewPreset, setPreviewPreset] = useState("");
  async function load(nextLayout = layout) {
    try {
      const data = (await api.tonight(nextLayout)) as TonightPayload;
      setPayload(data);
      setError("");
    } catch (err) {
      const toast = errorToast(err, "Could not load tonight");
      setError(toast.text);
      notify(toast.kind, toast.text);
    }
  }
  useEffect(() => {
    api.layouts().then(setLayouts).catch(() => undefined);
  }, []);
  useEffect(() => {
    void load(layout);
  }, [layout]);
  const image = payload?.status?.imageUrl;
  const video = payload?.status?.videoUrl;
  const artwork = payload?.preview?.artworkUrl;
  const queueLabel = payload?.status?.queue ? QUEUE_LABELS[payload.status.queue] || payload.status.queue : "Tonight";
  const motionStyle = (payload?.motion?.style || "parallax") as MotionStyle;
  const motionPreset = previewPreset || payload?.motion?.preset || "cinematic";
  const intensity = intensityFromPreset(motionPreset) || clampIntensity(payload?.motion?.intensity ?? 0.55);
  const duration = PRESET_DURATION[motionPreset] || defaultDuration("light");
  const motionVars = motionPreviewVars(motionStyle, intensity, duration);
  const tonightPath = typeof payload?.status?.path === "string" ? payload.status.path : "";
  const layeredArt = Boolean(!video && artwork);
  async function bakeTonight(wholeLayout = false) {
    try {
      await run({
        kind: "motion",
        layout,
        path: wholeLayout ? undefined : tonightPath || undefined,
      });
      await load(layout);
    } catch {
      /* toast from JobProvider */
    }
  }
  return (
    <section>
      <h1>Tonight’s home screen</h1>
      <p className="lede">
        Preview how Wallpaparr will sit behind Projectivy chrome — clock, rows, and the dock. Artwork can drift; the title and TV chrome stay put.
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
        <button className="btn tiny" disabled={busy || !tonightPath} onClick={() => bakeTonight(false)}>
          Bake motion for tonight’s pick
        </button>
        <button className="btn ghost tiny" disabled={busy} onClick={() => bakeTonight(true)}>
          Bake motion for this layout
        </button>
      </div>
      <div className="chip-row">
        <span className="muted">Motion preview</span>
        {(["subtle", "cinematic", "bold"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            className={`chip ${motionPreset === preset ? "active" : ""}`}
            onClick={() => setPreviewPreset(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="tonight-grid">
        <WallpaperStage
          wrapClassName="tv-preview"
          ariaLabel="Projectivy home screen preview"
          artSrc={layeredArt ? artwork : image}
          artAlt={payload?.status?.title || "Wallpaper"}
          videoSrc={video}
          motionOn={layeredArt}
          motionVars={motionVars as CSSProperties}
          lightLeak={Boolean(payload?.motion?.light_leak)}
        >
          <div className="tv-chrome">
            <div className="tv-top">
              <span className="tv-logo">projectivy</span>
              <span className="tv-clock">9:41</span>
            </div>
            <div className="tv-hero-meta">
              <span className="badge">{queueLabel}</span>
              <ChromePills
                watchState={payload?.status?.watchState}
                libraryState={payload?.status?.libraryState}
                availability={payload?.status?.availability}
                source={payload?.status?.source}
              />
              {payload?.status?.pinned && <span className="badge">Pinned</span>}
              {payload?.status?.mediaType === "video" && <span className="badge badge-video">VIDEO</span>}
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
        </WallpaperStage>
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
            Motion {motionPreset} · {motionStyle}
            {payload?.motion?.light_leak ? " · light leak" : ""} — {describeMotion(motionStyle, intensity, duration)}.
            CSS preview pans the artwork only; title and TV chrome stay pinned. Bake VIDEO so Projectivy can play a real MP4.
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

function csvToIds(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function GeneratePage() {
  const notify = useToasts();
  const { run, busy } = useJobs();
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
      const preferred = names.includes("Netflix Hero") ? "Netflix Hero" : names[0];
      if (preferred) setForm((f) => ({ ...f, layout: preferred }));
    });
    api.settings().then(setSettings).catch(() => undefined);
  }, []);
  const style = (settings?.motion_style || "parallax") as MotionStyle;
  const intensity = intensityFromPreset(settings?.motion_preset) || clampIntensity(settings?.motion_intensity ?? 0.55);
  const duration = settings?.motion_duration || defaultDuration(settings?.motion_quality || "light");
  const motionVars = motionPreviewVars(style, intensity, Number(duration));
  return (
    <section>
      <h1>Generate</h1>
      <p className="lede">
        Batch cinematic stills from Jellyfin, Jellyseerr, or the built-in demo catalog (NASA / NARA / Library of Congress stills). Skip already-rendered titles by Jellyfin / TMDB / IMDb id, replace them in place, or bake optional parallax VIDEO loops for Projectivy. Layout <code>title_display</code> paints a movie/series logo when one exists.
      </p>
      <div className="generate-grid">
        <div className="card">
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
          <label style={{ marginTop: 12 }}><input type="checkbox" checked={form.skip_existing} disabled={form.replace_existing} onChange={(e) => setForm({ ...form, skip_existing: e.target.checked })} /> Skip titles already generated (IMDb / TMDB / Jellyfin id)</label>
          <label><input type="checkbox" checked={form.replace_existing} onChange={(e) => setForm({ ...form, replace_existing: e.target.checked, skip_existing: e.target.checked ? false : form.skip_existing })} /> Replace / overwrite same show</label>
          <label><input type="checkbox" checked={form.cleanup} onChange={(e) => setForm({ ...form, cleanup: e.target.checked })} /> Cleanup titles no longer in the source list</label>
          <label><input type="checkbox" checked={form.motion} onChange={(e) => setForm({ ...form, motion: e.target.checked })} /> Bake parallax / motion VIDEO (ffmpeg)</label>
          <p className="muted flag-help">{describeBatchFlags({ skip_existing: form.skip_existing, replace_existing: form.replace_existing, cleanup: form.cleanup, ids: csvToIds(form.ids), skip_ids: csvToIds(form.skip_ids) })}</p>
          <p className="muted">{describeMotion(style, intensity, Number(duration))}. Stills always remain; Projectivy only gets <code>videoUrl</code> when an MP4 exists. Intensity preset: {settings?.motion_preset || "cinematic"}{settings?.light_leak ? " · light leak" : ""}.</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                try {
                  const out = await run({
                    kind: "generate",
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
                  setResult(out.message || String((out.result as { message?: string } | null)?.message || ""));
                } catch (err) {
                  setResult(errorToast(err, "Generate failed").text);
                }
              }}
            >
              Run batch
            </button>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={async () => {
                try {
                  const out = await run({ kind: "motion", layout: form.layout });
                  setResult(out.message || String((out.result as { message?: string } | null)?.message || ""));
                } catch (err) {
                  setResult(errorToast(err, "Motion bake failed").text);
                }
              }}
            >
              Bake motion for this layout
            </button>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={async () => {
                try {
                  const tonight = (await api.tonight(form.layout)) as { status?: { path?: string | null } };
                  const path = tonight.status?.path || "";
                  if (!path) {
                    notify("info", `No tonight pick for ${form.layout} yet — generate stills first.`);
                    setResult(`No tonight pick for ${form.layout}.`);
                    return;
                  }
                  const out = await run({ kind: "motion", layout: form.layout, path });
                  setResult(out.message || String((out.result as { message?: string } | null)?.message || ""));
                } catch (err) {
                  setResult(errorToast(err, "Motion bake failed").text);
                }
              }}
            >
              Bake motion for tonight’s pick
            </button>
          </div>
          {result && <p className="status">{result}</p>}
        </div>
        <div className="card">
          <h3>Motion preview</h3>
          <p className="muted">See {settings?.motion_preset || "cinematic"} {style} on demo art before you bake ffmpeg loops. Artwork moves; watch and Seerr chrome stay put.</p>
          <WallpaperStage
            className="generate-preview"
            wrapClassName="canvas-wrap generate-preview"
            artSrc={api.mediaArtwork("demo-jf-4")}
            artAlt="Signal Country motion preview"
            motionOn
            motionVars={motionVars as CSSProperties}
            lightLeak={Boolean(settings?.light_leak)}
          >
            <SampleLockedChrome
              title="Signal Country"
              watchState="unwatched"
              libraryState="seerr_only"
              availability="requestable"
              source="jellyseerr"
            />
            <div className="tv-chrome editor-tv" aria-hidden="true">
              <div className="tv-top">
                <span className="tv-logo">projectivy</span>
                <span className="tv-clock">9:41</span>
              </div>
              <div className="tv-dock" />
            </div>
          </WallpaperStage>
        </div>
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
  const notify = useToasts();
  const { run, busy } = useJobs();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState("");
  const [layouts, setLayouts] = useState<string[]>([]);
  useEffect(() => {
    api.settings().then((loaded) => setSettings({ ...EMPTY_SETTINGS, ...loaded })).catch(() => setSettings(EMPTY_SETTINGS));
    api.layouts().then(setLayouts).catch(() => undefined);
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
  const motionVars = motionPreviewVars(style, intensity, duration);
  async function testConnection(name: "jellyfin" | "jellyseerr" | "tmdb") {
    try {
      const result = (await api.testProvider(name)) as { ok?: boolean; message?: string; error?: string };
      const toast = providerToast(result);
      notify(toast.kind, toast.text);
      setMsg(toast.text);
    } catch (err) {
      const toast = errorToast(err, `Could not test ${name}`);
      notify(toast.kind, toast.text);
      setMsg(toast.text);
    }
  }
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
            <option value="parallax">Parallax — artwork drifts, chrome stays locked</option>
            <option value="kenburns">Ken Burns — artwork zoom; chrome locked</option>
            <option value="drift">Drift — slow pan of artwork; chrome locked</option>
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
            <option value="light">light (~8s, 2.2 Mbps)</option>
            <option value="standard">standard (~12s, 3.5 Mbps)</option>
            <option value="cinematic">cinematic (~16s, 5 Mbps)</option>
          </select>
          <label>Loop duration seconds (blank = longer quality / intensity default, 2–24s)</label>
          <input
            type="number"
            min={2}
            max={24}
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
          <p className="muted">{describeMotion(style, intensity, duration)}. Intensity changes background amplitude only.</p>
          <div style={{ marginTop: 12 }}>
            <WallpaperStage
              wrapClassName="canvas-wrap generate-preview"
              artSrc={api.mediaArtwork("demo-jf-1")}
              artAlt="Motion intensity preview"
              motionOn
              motionVars={motionVars as CSSProperties}
              lightLeak={Boolean(settings.light_leak)}
            >
              <SampleLockedChrome title="Northlight" />
            </WallpaperStage>
          </div>
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
          <h3>Title / logo</h3>
          <p className="muted">Default for new layouts. Each layout DNA JSON also stores <code>title_display</code> so Generate and the editor can prefer a clearlogo, always use the name, or auto-pick.</p>
          <label>Title display</label>
          <select
            value={settings.title_display || "auto"}
            aria-label="Default title display"
            onChange={(e) => setSettings({ ...settings, title_display: e.target.value as "auto" | "logo" | "text" })}
          >
            <option value="auto">Auto — logo if fetched, otherwise the name</option>
            <option value="logo">Prefer logo</option>
            <option value="text">Always title text</option>
          </select>
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
          <button className="btn ghost tiny" style={{ marginTop: 10 }} onClick={() => testConnection("jellyfin")}>Test Jellyfin</button>
        </div>
        <div className="card">
          <h3>Jellyseerr / Seerr</h3>
          <label>URL</label>
          <input value={settings.jellyseerr.url || ""} onChange={(e) => patch("jellyseerr", "url", e.target.value)} placeholder="http://192.168.1.10:5055" />
          <label>API key</label>
          <input value={settings.jellyseerr.api_key || ""} onChange={(e) => patch("jellyseerr", "api_key", e.target.value)} />
          <button className="btn ghost tiny" style={{ marginTop: 10 }} onClick={() => testConnection("jellyseerr")}>Test Seerr</button>
        </div>
        <div className="card">
          <h3>TMDB (optional enrichment)</h3>
          <label>API key</label>
          <input value={settings.tmdb.api_key || ""} onChange={(e) => patch("tmdb", "api_key", e.target.value)} />
          <label>Language</label>
          <input value={settings.tmdb.language || "en-US"} onChange={(e) => patch("tmdb", "language", e.target.value)} />
          <button className="btn ghost tiny" style={{ marginTop: 10 }} onClick={() => testConnection("tmdb")}>Test TMDB</button>
        </div>
        <div className="card">
          <h3>Cron / batch</h3>
          <p className="muted">Scheduled generate uses the same skip / replace / cleanup / id rules as the Generate page. Save settings to persist the schedule, or run now for a toast with created / skipped / cleaned counts.</p>
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
          <select value={String(cron.layout || "Netflix Hero")} onChange={(e) => setCron({ ...cron, layout: e.target.value })} aria-label="Cron layout">
            {(layouts.includes(String(cron.layout || "")) || !cron.layout ? layouts : [String(cron.layout), ...layouts]).map((name) => (
              <option key={name}>{name}</option>
            ))}
            {layouts.length === 0 && <option>Netflix Hero</option>}
          </select>
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
            placeholder="demo-jf-1, 90001"
          />
          <label>Skip ids (comma)</label>
          <input
            value={Array.isArray(cron.skip_ids) ? cron.skip_ids.join(",") : String(cron.skip_ids || "")}
            onChange={(e) => setCron({ ...cron, skip_ids: csvToIds(e.target.value) })}
            placeholder="leave blank to skip none extra"
          />
          <label>
            <input
              type="checkbox"
              checked={Boolean(cron.skip_existing)}
              disabled={Boolean(cron.replace_existing)}
              onChange={(e) => setCron({ ...cron, skip_existing: e.target.checked })}
            />{" "}
            Skip existing by media id
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(cron.replace_existing)}
              onChange={(e) => setCron({ ...cron, replace_existing: e.target.checked, skip_existing: e.target.checked ? false : cron.skip_existing })}
            />{" "}
            Overwrite / replace
          </label>
          <label><input type="checkbox" checked={Boolean(cron.cleanup)} onChange={(e) => setCron({ ...cron, cleanup: e.target.checked })} /> Cleanup missing titles</label>
          <label><input type="checkbox" checked={Boolean(cron.motion)} onChange={(e) => setCron({ ...cron, motion: e.target.checked })} /> Bake parallax VIDEO</label>
          <p className="muted flag-help">
            {describeBatchFlags({
              skip_existing: Boolean(cron.skip_existing),
              replace_existing: Boolean(cron.replace_existing),
              cleanup: Boolean(cron.cleanup),
              ids: Array.isArray(cron.ids) ? cron.ids : csvToIds(String(cron.ids || "")),
              skip_ids: Array.isArray(cron.skip_ids) ? cron.skip_ids : csvToIds(String(cron.skip_ids || "")),
            })}
          </p>
          <button
            className="btn tiny"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={async () => {
              try {
                const out = await run({
                  kind: "cron",
                  layout: cron.layout,
                  source: cron.source,
                  limit: cron.limit,
                  skip_existing: cron.skip_existing,
                  replace_existing: cron.replace_existing,
                  cleanup: cron.cleanup,
                  motion: cron.motion,
                  ids: Array.isArray(cron.ids) ? cron.ids : csvToIds(String(cron.ids || "")),
                  skip_ids: Array.isArray(cron.skip_ids) ? cron.skip_ids : csvToIds(String(cron.skip_ids || "")),
                });
                setMsg(out.message || String((out.result as { message?: string } | null)?.message || ""));
              } catch (err) {
                setMsg(errorToast(err, "Cron run failed").text);
              }
            }}
          >
            Run now
          </button>
        </div>
      </div>
      <button
        className="btn"
        style={{ marginTop: 18 }}
        onClick={async () => {
          try {
            await api.saveSettings(settings);
            setMsg("Saved settings");
            notify("ok", "Saved settings");
            onTheme(settings.editor_theme || "cinema");
          } catch (err) {
            const toast = errorToast(err, "Could not save settings");
            notify(toast.kind, toast.text);
            setMsg(toast.text);
          }
        }}
      >
        Save settings
      </button>
      {msg && <p className="status">{msg}</p>}
    </section>
  );
}
