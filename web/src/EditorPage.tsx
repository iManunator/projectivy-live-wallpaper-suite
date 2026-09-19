import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { api } from "./lib/api";
import { applyLook, LOOK_PRESETS, stageOverlayStyle } from "./lib/gradient";
import {
  duplicateLayout,
  normalizeLayout,
  SLOTS,
  validateLayout,
  type Layout,
  type WallpaperRecord,
} from "./lib/layout";
import { errorToast } from "./lib/messages";
import { clampIntensity, defaultDuration, describeMotion, intensityFromPreset, motionPreviewVars, type MotionStyle } from "./lib/motion";
import { prefersLogo, smartResizeLogo, clampLogoRect, tagShift } from "./lib/logo";
import { useToasts } from "./toasts";

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
  tmdb_id?: string | null;
  backdrop_url?: string | null;
  poster_url?: string | null;
  logo_url?: string | null;
  media_type?: string | null;
};

type ViewerItem = { src: string; title: string; subtitle?: string };

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

function sampleFromMedia(item: MediaRow): Record<string, string> {
  const genres = (item.genres || []).slice(0, 3).join("  ·  ");
  const watch = (item.watch_state || "").replace(/_/g, " ");
  const watchLabel = watch ? watch.charAt(0).toUpperCase() + watch.slice(1) : "";
  const source = item.source || "demo";
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

function mediaKey(item: MediaRow): string {
  return String(item.jellyfin_id || item.tmdb_id || item.title || "");
}

function wallpaperSlide(item: WallpaperRecord): ViewerItem {
  return {
    src: api.wallpaperImage(item.layout, item.filename),
    title: item.title,
    subtitle: [item.year, item.layout].filter(Boolean).join(" · "),
  };
}

export function FullscreenViewer({
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

export function EditorPage() {
  const notify = useToasts();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>(normalizeLayout(null));
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewSource, setPreviewSource] = useState<"demo" | "jellyfin">("demo");
  const [catalog, setCatalog] = useState<MediaRow[]>([]);
  const [created, setCreated] = useState<WallpaperRecord[]>([]);
  const [previewId, setPreviewId] = useState("");
  const [viewer, setViewer] = useState<number | null>(null);
  const [motionOn, setMotionOn] = useState(true);
  const [showTv, setShowTv] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [motionStyle, setMotionStyle] = useState<MotionStyle>("parallax");
  const [motionPreset, setMotionPreset] = useState("cinematic");
  const [lightLeak, setLightLeak] = useState(true);
  const [duration, setDuration] = useState(6);
  const [logoSrc, setLogoSrc] = useState("");
  const [logoNatural, setLogoNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    api.layouts().then(async (list) => {
      setNames(list);
      const preferred = list.includes("Netflix Hero") ? "Netflix Hero" : list[0];
      if (preferred) setLayout(normalizeLayout(await api.layout(preferred)));
    });
    api
      .settings()
      .then((settings) => {
        setMotionStyle((settings.motion_style || "parallax") as MotionStyle);
        setMotionPreset(settings.motion_preset || "cinematic");
        setLightLeak(Boolean(settings.light_leak));
        setDuration(Number(settings.motion_duration || defaultDuration(settings.motion_quality || "light")));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .media(previewSource, 16)
      .then((rows) => {
        const usable = (rows as MediaRow[]).filter((row) => mediaKey(row));
        setCatalog(usable);
        if (usable[0]) setPreviewId(mediaKey(usable[0]));
      })
      .catch(() => setCatalog([]));
  }, [previewSource]);

  useEffect(() => {
    api.gallery(layout.name).then(setCreated).catch(() => setCreated([]));
  }, [layout.name]);

  const errors = useMemo(() => validateLayout(layout), [layout]);
  const layer = layout.layers[selected];
  const preview = catalog.find((row) => mediaKey(row) === previewId) || catalog[0];
  const sample = preview ? sampleFromMedia(preview) : SAMPLE;
  const artId = preview ? mediaKey(preview) : "demo-jf-1";
  const artSrc = api.mediaArtwork(artId);
  const createdSlides = created.map(wallpaperSlide);
  const intensity = intensityFromPreset(motionPreset) || clampIntensity(0.55);
  const motionVars = motionPreviewVars(motionStyle, intensity, duration);
  const showLogo = prefersLogo(layout.title_display) && Boolean(logoSrc);
  const titleLayer = layout.layers.find((row) => row.slot === "title");
  const logoBox = (() => {
    if (!showLogo || !logoNatural || !titleLayer) return null;
    const maxW = Math.min(layout.logo_max_width || 1200, titleLayer.width || 860, layout.canvas_width - 144);
    const maxH = Math.min(layout.logo_max_height || 450, titleLayer.height || 450, layout.canvas_height - 316);
    const sized = smartResizeLogo(logoNatural.w, logoNatural.h, maxW, maxH);
    return clampLogoRect(titleLayer.x, titleLayer.y, sized.width, sized.height, layout.canvas_width, layout.canvas_height);
  })();
  const metaYs = layout.layers.filter((row) => row.slot !== "title").map((row) => row.y);
  const logoShift =
    logoBox && titleLayer && metaYs.length
      ? tagShift(logoBox.y, logoBox.height, Math.min(...metaYs), layout.logo_padding || 25)
      : 0;

  useEffect(() => {
    if (!prefersLogo(layout.title_display) || !artId) {
      setLogoSrc("");
      setLogoNatural(null);
      return;
    }
    const url = api.mediaLogo(artId, preview?.tmdb_id, preview?.media_type || "movie");
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (cancelled) return;
      setLogoSrc(url);
      setLogoNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
    };
    probe.onerror = () => {
      if (cancelled) return;
      setLogoSrc("");
      setLogoNatural(null);
      if (layout.title_display === "logo") {
        notify("info", "No logo for this title — showing the name.");
      }
    };
    probe.src = url;
    return () => {
      cancelled = true;
    };
  }, [artId, layout.title_display, notify, preview?.media_type, preview?.tmdb_id]);

  async function load(name: string) {
    setLayout(normalizeLayout(await api.layout(name)));
    setSelected(0);
  }

  async function save() {
    setError("");
    if (errors.length) {
      setError(errors.join(" · "));
      notify("error", errors[0]);
      return;
    }
    try {
      await api.saveLayout(layout);
      setNames(await api.layouts());
      const text = `Saved “${layout.name}”`;
      setStatus(text);
      notify("ok", text);
    } catch (err) {
      const toast = errorToast(err, "Could not save layout");
      setError(toast.text);
      notify(toast.kind, toast.text);
    }
  }

  function patchBackground(patch: Partial<Layout["background"]>) {
    setLayout({ ...layout, background: { ...layout.background, ...patch } });
  }

  function startDrag(event: ReactMouseEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();
    setSelected(index);
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const current = layout.layers[index];
    const originX = event.clientX;
    const originY = event.clientY;
    function onMove(moveEvent: MouseEvent) {
      const dx = ((moveEvent.clientX - originX) / rect.width) * layout.canvas_width;
      const dy = ((moveEvent.clientY - originY) / rect.height) * layout.canvas_height;
      const next = {
        ...current,
        x: Math.max(0, Math.round(current.x + dx)),
        y: Math.max(0, Math.round(current.y + dy)),
      };
      setLayout((prev) => ({
        ...prev,
        layers: prev.layers.map((row, i) => (i === index ? next : row)),
      }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <section>
      <h1>Layout editor</h1>
      <p className="lede">
        Flagship 16:9 stage for Projectivy: multi-stop gradients, vignette, edge fades, movie logos, and a motion
        preview so you can see parallax / Ken Burns without a TV. Drag metadata chips. Save persists the layout JSON.
      </p>
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
            <button className="btn tiny" onClick={save}>
              Save layout
            </button>
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <label className="inline">
              Preview source
              <select
                value={previewSource}
                aria-label="Preview source"
                onChange={(e) => setPreviewSource(e.target.value as "demo" | "jellyfin")}
              >
                <option value="demo">Demo catalog</option>
                <option value="jellyfin">Jellyfin</option>
              </select>
            </label>
            <label className="inline">
              Title display
              <select
                value={layout.title_display || "auto"}
                aria-label="Title display"
                onChange={(e) =>
                  setLayout({ ...layout, title_display: e.target.value as "auto" | "logo" | "text" })
                }
              >
                <option value="auto">Auto — logo if fetched</option>
                <option value="logo">Logo</option>
                <option value="text">Title text</option>
              </select>
            </label>
          </div>
          {catalog.length > 0 && (
            <>
              <label>{previewSource === "jellyfin" ? "Jellyfin preview" : "Demo preview"}</label>
              <select
                value={previewId}
                onChange={(e) => setPreviewId(e.target.value)}
                aria-label={previewSource === "jellyfin" ? "Jellyfin preview" : "Demo preview"}
              >
                {catalog.map((item) => (
                  <option key={mediaKey(item)} value={mediaKey(item)}>
                    {item.title}
                    {item.year ? ` (${item.year})` : ""}
                  </option>
                ))}
              </select>
            </>
          )}
          {previewSource === "jellyfin" && catalog.length === 0 && (
            <p className="muted">No Jellyfin artwork yet — connect Jellyfin in Settings, or preview the demo catalog.</p>
          )}
          <label>Layout name</label>
          <input value={layout.name} onChange={(e) => setLayout({ ...layout, name: e.target.value })} />
          <div className="editor-toolbar">
            <button type="button" className={`chip ${motionOn ? "active" : ""}`} onClick={() => setMotionOn((v) => !v)}>
              {motionOn ? "Motion on" : "Motion off"}
            </button>
            <button type="button" className={`chip ${showTv ? "active" : ""}`} onClick={() => setShowTv((v) => !v)}>
              TV chrome
            </button>
            <button type="button" className={`chip ${showGuides ? "active" : ""}`} onClick={() => setShowGuides((v) => !v)}>
              Safe zone
            </button>
            {(["subtle", "cinematic", "bold"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`chip ${motionPreset === preset ? "active" : ""}`}
                onClick={() => setMotionPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="canvas-wrap" ref={stageRef} style={{ marginTop: 14 }}>
            {artSrc && (
              <img
                className={`canvas-art ${motionOn ? "motion-art" : ""}`}
                style={motionOn ? (motionVars as CSSProperties) : undefined}
                src={artSrc}
                alt={`${preview?.title || "Library"} artwork`}
              />
            )}
            <div className={`canvas-stage ${artSrc ? "has-art" : ""}`} style={stageOverlayStyle(layout.background)}>
              {showGuides && (
                <div className="safe-guides" aria-hidden="true">
                  <span className="safe-clock" />
                  <span className="safe-dock" />
                </div>
              )}
              {layout.layers
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.visible)
                .map(({ item, index }) => {
                  const isLogoTitle = Boolean(item.slot === "title" && showLogo && logoBox);
                  const y = isLogoTitle && logoBox ? logoBox.y : item.y + (item.slot === "title" ? 0 : logoShift);
                  const x = isLogoTitle && logoBox ? logoBox.x : item.x;
                  return (
                    <div
                      key={item.id}
                      className={`layer-chip ${index === selected ? "selected" : ""} ${isLogoTitle ? "is-logo" : ""}`}
                      onMouseDown={(event) => startDrag(event, index)}
                      style={{
                        left: `${(x / layout.canvas_width) * 100}%`,
                        top: `${(y / layout.canvas_height) * 100}%`,
                        fontSize: Math.max(10, item.font_size * 0.35),
                        fontWeight: item.font_weight === "bold" ? 700 : 500,
                        color: item.color,
                        width: isLogoTitle && logoBox ? `${(logoBox.width / layout.canvas_width) * 100}%` : undefined,
                        maxWidth: item.width ? `${(item.width / layout.canvas_width) * 100}%` : undefined,
                        whiteSpace: item.slot === "overview" ? "normal" : "nowrap",
                      }}
                    >
                      {isLogoTitle ? (
                        <img className="stage-logo" src={logoSrc} alt={`${sample.title || "Title"} logo`} />
                      ) : (
                        sample[item.slot] || item.slot
                      )}
                    </div>
                  );
                })}
            </div>
            {showTv && (
              <div className="tv-chrome editor-tv" aria-hidden="true">
                <div className="tv-top">
                  <span className="tv-logo">projectivy</span>
                  <span className="tv-clock">9:41</span>
                </div>
                <div className="tv-dock" />
              </div>
            )}
            {motionOn && lightLeak && <div className="motion-leak" />}
          </div>
          <p className="muted">
            {describeMotion(motionStyle, intensity, duration)}
            {lightLeak ? " · light leak" : ""}. Intensity {motionPreset} is a CSS preview — the TV still needs a baked
            VIDEO for the real loop.
          </p>
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
          <h3>Look</h3>
          <div className="chip-row">
            {LOOK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="chip"
                title={preset.blurb}
                onClick={() => setLayout(applyLook(layout, preset))}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label>Gradient type</label>
          <select
            value={layout.background.gradient_type || "linear"}
            onChange={(e) => patchBackground({ gradient_type: e.target.value })}
            aria-label="Gradient type"
          >
            <option value="linear">Linear</option>
            <option value="radial">Radial</option>
          </select>
          {layout.background.gradient_type !== "radial" && (
            <>
              <label>Angle ({Math.round(layout.background.gradient_angle || 0)}°)</label>
              <input
                type="range"
                min={0}
                max={360}
                value={layout.background.gradient_angle || 0}
                onChange={(e) => patchBackground({ gradient_angle: Number(e.target.value) })}
                aria-label="Gradient angle"
              />
            </>
          )}
          <label>Gradient opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layout.background.gradient_opacity || 0}
            onChange={(e) => patchBackground({ gradient_opacity: Number(e.target.value) })}
            aria-label="Gradient opacity"
          />
          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <strong>Stops</strong>
            <button
              type="button"
              className="btn ghost tiny"
              onClick={() =>
                patchBackground({
                  gradient_stops: [
                    ...(layout.background.gradient_stops || []),
                    { color: layout.background.color, position: 0.5, opacity: 0.4 },
                  ],
                })
              }
            >
              Add stop
            </button>
          </div>
          {(layout.background.gradient_stops || []).map((stop, index) => (
            <div className="stop-row" key={`${stop.position}-${index}`}>
              <input
                type="color"
                value={stop.color.length === 7 ? stop.color : "#000000"}
                onChange={(e) => {
                  const stops = (layout.background.gradient_stops || []).slice();
                  stops[index] = { ...stop, color: e.target.value };
                  patchBackground({ gradient_stops: stops });
                }}
                aria-label={`Stop ${index + 1} color`}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={stop.position}
                onChange={(e) => {
                  const stops = (layout.background.gradient_stops || []).slice();
                  stops[index] = { ...stop, position: Number(e.target.value) };
                  patchBackground({ gradient_stops: stops });
                }}
                aria-label={`Stop ${index + 1} position`}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={stop.opacity}
                onChange={(e) => {
                  const stops = (layout.background.gradient_stops || []).slice();
                  stops[index] = { ...stop, opacity: Number(e.target.value) };
                  patchBackground({ gradient_stops: stops });
                }}
                aria-label={`Stop ${index + 1} opacity`}
              />
              <button
                type="button"
                className="btn ghost tiny"
                onClick={() =>
                  patchBackground({
                    gradient_stops: (layout.background.gradient_stops || []).filter((_, i) => i !== index),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <label>Vignette</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layout.background.vignette || 0}
            onChange={(e) => patchBackground({ vignette: Number(e.target.value) })}
            aria-label="Vignette"
          />
          <label>Overlay opacity</label>
          <div className="row">
            <input
              type="color"
              value={layout.background.overlay_color || "#000000"}
              onChange={(e) => patchBackground({ overlay_color: e.target.value })}
              aria-label="Overlay color"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layout.background.overlay_opacity || 0}
              onChange={(e) => patchBackground({ overlay_opacity: Number(e.target.value) })}
              aria-label="Overlay opacity"
            />
          </div>
          <label>Edge fades (left / right / top / bottom)</label>
          <div className="fade-grid">
            {(["fade_left", "fade_right", "fade_top", "fade_bottom"] as const).map((key) => (
              <input
                key={key}
                type="range"
                min={0}
                max={0.8}
                step={0.01}
                value={layout.background[key]}
                onChange={(e) => patchBackground({ [key]: Number(e.target.value) })}
                aria-label={key.replace("fade_", "Fade ")}
              />
            ))}
          </div>
          <label>Softness / brightness / wash</label>
          <div className="row">
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={layout.background.fade_softness}
              onChange={(e) => patchBackground({ fade_softness: Number(e.target.value) })}
              aria-label="Fade softness"
            />
            <input
              type="range"
              min={0.4}
              max={1.4}
              step={0.01}
              value={layout.background.brightness}
              onChange={(e) => patchBackground({ brightness: Number(e.target.value) })}
              aria-label="Brightness"
            />
            <input
              type="color"
              value={layout.background.color || "#050505"}
              onChange={(e) => patchBackground({ color: e.target.value })}
              aria-label="Wash color"
            />
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 18 }}>
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
