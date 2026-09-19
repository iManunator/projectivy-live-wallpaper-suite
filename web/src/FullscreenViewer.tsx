import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { WatchBadge } from "./WatchBadge";
import { WallpaperStage } from "./WallpaperStage";
import { api } from "./lib/api";
import { galleryPreviewSources } from "./lib/gallery";
import type { WallpaperRecord } from "./lib/layout";
import { clampIntensity, defaultDuration, intensityFromPreset, motionPreviewVars, PRESET_DURATION, type MotionStyle } from "./lib/motion";
import { useToasts } from "./toasts";

export type ViewerItem = {
  src: string;
  title: string;
  subtitle?: string;
  watchState?: string;
  id?: string;
  pinned?: boolean;
  hidden?: boolean;
  videoSrc?: string | null;
  plateSrc?: string;
  artworkSrc?: string | null;
  chromeSrc?: string;
  logoSrc?: string | null;
  artCandidates?: string[];
  stillSrc?: string;
  hasVideo?: boolean;
};

export function wallpaperSlide(item: WallpaperRecord): ViewerItem {
  const preview = galleryPreviewSources(item, api);
  return {
    src: preview.stillSrc,
    stillSrc: preview.stillSrc,
    title: item.title,
    subtitle: [item.year, item.layout].filter(Boolean).join(" · "),
    watchState: item.watch_state,
    id: item.id,
    pinned: item.pinned,
    hidden: item.hidden,
    videoSrc: preview.videoSrc,
    plateSrc: preview.plateSrc,
    artworkSrc: preview.artworkSrc,
    chromeSrc: preview.chromeSrc,
    logoSrc: preview.logoSrc,
    artCandidates: preview.artCandidates,
    hasVideo: Boolean(item.has_video && preview.videoSrc),
  };
}

export function FullscreenViewer({
  items,
  index,
  onClose,
  onIndex,
  onPin,
  onHide,
  onDelete,
}: {
  items: ViewerItem[];
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
  onPin?: (item: ViewerItem) => void;
  onHide?: (item: ViewerItem) => void;
  onDelete?: (item: ViewerItem) => void;
}) {
  const notify = useToasts();
  const item = items[index];
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [artIndex, setArtIndex] = useState(0);
  const [showLogo, setShowLogo] = useState(true);
  const [motion, setMotion] = useState({
    style: "parallax" as MotionStyle,
    intensity: 0.55,
    duration: 12,
    lightLeak: true,
  });

  useEffect(() => {
    api
      .settings()
      .then((settings) => {
        const style = (settings.motion_style as MotionStyle) || "parallax";
        const intensity = intensityFromPreset(settings.motion_preset) || clampIntensity(Number(settings.motion_intensity) || 0.55);
        const duration = Number(settings.motion_duration) || PRESET_DURATION[settings.motion_preset || ""] || defaultDuration(settings.motion_quality || "light");
        setMotion({
          style: style === "kenburns" || style === "drift" ? style : "parallax",
          intensity,
          duration,
          lightLeak: Boolean(settings.light_leak),
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setPaused(false);
    setVideoFailed(false);
    setArtIndex(0);
    setShowLogo(true);
  }, [item?.id, item?.videoSrc, item?.src]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (!items.length) return;
      if (event.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        setPaused((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items, onClose, onIndex]);

  const candidates = item?.artCandidates?.length ? item.artCandidates : [item?.artworkSrc, item?.plateSrc, item?.stillSrc || item?.src].filter(Boolean) as string[];
  const artSrc = candidates[Math.min(artIndex, Math.max(0, candidates.length - 1))] || item?.src;
  const stillSrc = item?.stillSrc || item?.src;
  const useVideo = Boolean(item?.videoSrc && !videoFailed);
  const usingComposite = Boolean(artSrc && stillSrc && artSrc === stillSrc);
  const showLockedChrome = Boolean(item && !useVideo && !usingComposite);
  const motionVars = useMemo(
    () => motionPreviewVars(motion.style, motion.intensity, motion.duration) as CSSProperties,
    [motion],
  );

  if (!item) return null;

  const modeLabel = useVideo ? "VIDEO" : "Motion preview";

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
        <WallpaperStage
          className="lightbox-stage"
          wrapClassName="tv-preview"
          ariaLabel={`${item.title} ${useVideo ? "VIDEO" : "layered motion preview"}`}
          artSrc={artSrc}
          artAlt={`${item.title} artwork`}
          videoSrc={useVideo ? item.videoSrc : null}
          motionOn={!useVideo}
          motionVars={motionVars}
          lightLeak={!useVideo && motion.lightLeak}
          paused={paused}
          onVideoError={() => {
            setVideoFailed(true);
            notify("error", "Could not play VIDEO. Showing layered motion preview.");
          }}
          onArtError={() => setArtIndex((current) => Math.min(current + 1, Math.max(0, candidates.length - 1)))}
        >
          {showLockedChrome ? (
            <div className="sample-chrome">
              {showLogo && item.logoSrc ? (
                <img
                  className="stage-logo sample-logo"
                  src={item.logoSrc}
                  alt=""
                  onError={() => setShowLogo(false)}
                />
              ) : null}
              <WatchBadge state={item.watchState} className="sample-badge" />
              <strong className="sample-title">{item.title}</strong>
            </div>
          ) : null}
        </WallpaperStage>
        <figcaption>
          <strong>{item.title}</strong>
          {item.subtitle ? <span className="muted">{item.subtitle}</span> : null}
          <WatchBadge state={item.watchState} />
          <span className={`badge ${useVideo ? "badge-video" : ""}`}>{modeLabel}</span>
        </figcaption>
        <div className="lightbox-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn ghost tiny" onClick={() => setPaused((current) => !current)}>
            {paused ? "Play" : "Pause"}
          </button>
          {onPin && (
            <button type="button" className="btn ghost tiny" onClick={() => onPin(item)}>
              {item.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {onHide && (
            <button type="button" className="btn ghost tiny" onClick={() => onHide(item)}>
              {item.hidden ? "Allow again" : "Never show"}
            </button>
          )}
          {onDelete && (
            <button type="button" className="btn danger tiny" onClick={() => onDelete(item)}>
              Delete
            </button>
          )}
        </div>
      </figure>
    </div>
  );
}
