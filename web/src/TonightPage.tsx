import { useEffect, useState, type CSSProperties } from "react";
import { api } from "./lib/api";
import { errorToast } from "./lib/messages";
import {
  clampIntensity,
  describeMotion,
  intensityFromPreset,
  motionPreviewVars,
  PRESET_DURATION,
  type MotionStyle,
} from "./lib/motion";
import { LAYOUT_DNA, QUEUE_LABELS, TASTE_PRESETS } from "./lib/queues";
import { watchBadge } from "./lib/watch";
import { WatchBadge } from "./WatchBadge";
import { WallpaperStage } from "./WallpaperStage";
import { useJobs } from "./JobProgress";
import { useToasts } from "./toasts";

export type TonightPayload = {
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
  };
  queues: Array<{ id: string; label: string; count: number; titles: string[] }>;
  profile: string;
  motion: { style?: string; preset?: string; intensity?: number; light_leak?: boolean };
  preview?: { artworkUrl?: string | null; itemId?: string | null; layered?: boolean };
};

const PREVIEW_INTENSITY = ["subtle", "cinematic", "bold"] as const;

function titleCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function isSeerrQueue(queue?: string | null): boolean {
  const id = (queue || "").toLowerCase();
  return id === "seerr_trending" || id === "requestable";
}

type TonightPageProps = {
  onEdit: (layout: string) => void;
  onGenerate?: () => void;
  onSettings?: () => void;
};

export function TonightPage({ onEdit, onGenerate, onSettings }: TonightPageProps) {
  const notify = useToasts();
  const { run, busy } = useJobs();
  const [layout, setLayout] = useState("Netflix Hero");
  const [layouts, setLayouts] = useState<string[]>([]);
  const [payload, setPayload] = useState<TonightPayload | null>(null);
  const [error, setError] = useState("");
  const [previewPreset, setPreviewPreset] = useState("");
  async function load(nextLayout = layout, exclude?: string) {
    try {
      const data = (await api.tonight(nextLayout, exclude)) as TonightPayload;
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
  const queueId = payload?.status?.queue || "";
  const queueLabel = queueId ? QUEUE_LABELS[queueId] || queueId : "Tonight’s mix";
  const watch = watchBadge(payload?.status?.watchState);
  const queueDuplicatesWatch =
    (queueId === "unwatched" && watch?.id === "unwatched") ||
    (queueId === "continue_watching" && watch?.id === "partial");
  const showQueueBadge = Boolean(queueLabel) && !queueDuplicatesWatch;
  const motionStyle = (payload?.motion?.style || "parallax") as MotionStyle;
  const motionPreset = previewPreset || payload?.motion?.preset || "cinematic";
  const intensity = intensityFromPreset(motionPreset) || clampIntensity(payload?.motion?.intensity ?? 0.55);
  const duration = PRESET_DURATION[motionPreset] || 12;
  const motionVars = motionPreviewVars(motionStyle, intensity, duration);
  const tonightPath = typeof payload?.status?.path === "string" ? payload.status.path : "";
  const layeredArt = Boolean(!video && artwork);
  const hasPick = Boolean(image || artwork || tonightPath);
  const title = payload?.status?.title || "";
  const profile = payload?.profile || "tonight";
  const mix = TASTE_PRESETS[profile] || TASTE_PRESETS.tonight;
  const extraLayouts = layouts.filter((name) => !LAYOUT_DNA.some((preset) => preset.name === name));

  async function bakeThisPick() {
    try {
      await run({
        kind: "motion",
        layout,
        path: tonightPath || undefined,
      });
      await load(layout);
    } catch {
      /* toast from JobProvider */
    }
  }

  function refreshPick() {
    void load(layout, tonightPath || undefined);
  }

  const motionNote = video
    ? "Baked VIDEO is what Projectivy will play."
    : layeredArt
      ? `CSS preview only — ${describeMotion(motionStyle, intensity, duration)}. Bake to send an MP4 to the TV.`
      : "Still IMAGE. Bake motion if you want a VIDEO loop on the TV.";

  return (
    <section className="tonight-page">
      <header className="tonight-header">
        <h1>Tonight</h1>
        <p className="lede">
          This is the wallpaper Projectivy will show next from Tonight’s mix (
          <code>taste:{profile}</code>) — one pick, not the gallery.
        </p>
      </header>

      <div className="tonight-hero">
        <WallpaperStage
          wrapClassName="tv-preview"
          ariaLabel="Projectivy home screen preview"
          artSrc={layeredArt ? artwork : image}
          artAlt={title || "Wallpaper"}
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
              {showQueueBadge && <span className="badge">{queueLabel}</span>}
              <WatchBadge state={payload?.status?.watchState} />
              {isSeerrQueue(queueId) && <span className="badge">Seerr</span>}
              {payload?.status?.pinned && <span className="badge">Pinned</span>}
              {payload?.status?.mediaType === "video" && <span className="badge badge-video">VIDEO</span>}
              <h2>{title || "Waiting for a title"}</h2>
              <p>Behind the guide · {layout}</p>
            </div>
            <div className="tv-rows">
              <div className="tv-row-label">Continue watching</div>
              <div className="tv-posters">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="tv-dock" />
          </div>
        </WallpaperStage>
        <div className="tonight-pick">
          <p className="tonight-kicker">What Projectivy shows next</p>
          <div className="tonight-pick-title">
            <strong>{title || "No pick yet"}</strong>
            {showQueueBadge && <span className="badge">{queueLabel}</span>}
            <WatchBadge state={payload?.status?.watchState} />
            {isSeerrQueue(queueId) && <span className="badge">Seerr</span>}
            {payload?.status?.mediaType === "video" && <span className="badge badge-video">VIDEO</span>}
          </div>
          <p className="muted">{motionNote}</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!hasPick && (
        <p className="tonight-empty muted">
          Generate stills for this layout first, then come back to preview tonight’s pick.
          {onGenerate && (
            <>
              {" "}
              <button type="button" className="btn tiny" onClick={onGenerate}>
                Open Generate
              </button>
            </>
          )}
        </p>
      )}

      <div className="tonight-actions" role="group" aria-label="Tonight actions">
        <button className="btn" disabled={busy || !tonightPath} onClick={() => void bakeThisPick()}>
          Bake motion for this pick
        </button>
        <button className="btn ghost" type="button" onClick={() => onEdit(layout)}>
          Open in editor
        </button>
        <button className="btn ghost" type="button" onClick={refreshPick}>
          Refresh pick
        </button>
      </div>

      <div className="tonight-secondary" role="group" aria-label="Launcher look">
        <p className="tonight-label">Launcher look</p>
        <div className="chip-row tonight-chips">
          {LAYOUT_DNA.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={`chip ${layout === preset.name ? "active" : ""}`}
              onClick={() => setLayout(preset.name)}
              title={preset.blurb}
            >
              {preset.name}
            </button>
          ))}
          {extraLayouts.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip ${layout === name ? "active" : ""}`}
              onClick={() => setLayout(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {layeredArt && (
        <div className="tonight-secondary" role="group" aria-label="Preview intensity">
          <p className="tonight-label">Preview intensity</p>
          <div className="chip-row tonight-chips">
            {PREVIEW_INTENSITY.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`chip ${motionPreset === preset ? "active" : ""}`}
                onClick={() => setPreviewPreset(preset)}
              >
                {titleCase(preset)}
              </button>
            ))}
          </div>
          <p className="muted">Changes this CSS preview only. Bake uses the motion preset in Settings.</p>
        </div>
      )}

      <aside className="tonight-mix" aria-label="Tonight’s mix">
        <p>
          <strong>taste:{profile}</strong>
          <span className="muted">
            {" "}
            ·{" "}
            {Object.entries(mix)
              .map(([id, weight]) => `${weight}% ${QUEUE_LABELS[id] || id}`)
              .join(" · ")}
          </span>
          {onSettings && (
            <button type="button" className="btn ghost tiny tonight-mix-edit" onClick={onSettings}>
              Edit mix in Settings
            </button>
          )}
        </p>
        {(payload?.queues || []).length > 0 && (
          <div className="tonight-queues">
            {(payload?.queues || []).map((queue) => (
              <span className="chip quiet" key={queue.id} title={queue.titles.join(", ") || "Empty"}>
                {queue.label} <strong>{queue.count}</strong>
              </span>
            ))}
          </div>
        )}
      </aside>
    </section>
  );
}
