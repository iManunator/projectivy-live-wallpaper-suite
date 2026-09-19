import type { CSSProperties, ReactNode, Ref } from "react";

type WallpaperStageProps = {
  stageRef?: Ref<HTMLDivElement | null>;
  className?: string;
  wrapClassName?: string;
  artSrc?: string | null;
  artAlt?: string;
  videoSrc?: string | null;
  motionOn?: boolean;
  motionVars?: CSSProperties;
  lightLeak?: boolean;
  children?: ReactNode;
  ariaLabel?: string;
};

/**
 * Layered 16:9 stage: background art may Ken-Burns; foreground children stay pinned.
 * The frame uses object-fit:contain sizing so the stage never blows out the panel.
 */
export function WallpaperStage({
  stageRef,
  className,
  wrapClassName = "canvas-wrap",
  artSrc,
  artAlt = "",
  videoSrc,
  motionOn = false,
  motionVars,
  lightLeak = false,
  children,
  ariaLabel,
}: WallpaperStageProps) {
  const moving = Boolean(motionOn && !videoSrc && artSrc);
  return (
    <div className={`stage-frame ${className || ""}`.trim()}>
      <div className={wrapClassName} ref={stageRef} aria-label={ariaLabel}>
        <div className="stage-bg">
          {videoSrc ? (
            <video className="canvas-art tv-art" src={videoSrc} autoPlay muted loop playsInline />
          ) : artSrc ? (
            <img
              className={`canvas-art tv-art ${moving ? "motion-art" : ""}`}
              style={moving ? motionVars : undefined}
              src={artSrc}
              alt={artAlt}
            />
          ) : (
            <div className="tv-art tv-art-empty">Generate a batch to fill tonight</div>
          )}
          {moving && lightLeak ? <div className="motion-leak" /> : null}
        </div>
        <div className="stage-fg">{children}</div>
      </div>
    </div>
  );
}

export function SampleLockedChrome({ title = "Northlight" }: { title?: string }) {
  return (
    <div className="sample-chrome" aria-hidden="true">
      <span className="badge badge-watch unwatched sample-badge">Unwatched</span>
      <strong className="sample-title">{title}</strong>
    </div>
  );
}
