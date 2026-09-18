export type MotionStyle = "parallax" | "kenburns" | "drift";

export function clampIntensity(value: number): number {
  if (Number.isNaN(value)) return 0.55;
  return Math.min(1, Math.max(0, value));
}

export function defaultDuration(quality: string): number {
  if (quality === "cinematic") return 10;
  if (quality === "standard") return 8;
  return 6;
}

export function describeMotion(style: MotionStyle, intensity: number, duration: number): string {
  const depth = intensity >= 0.7 ? "bold" : intensity >= 0.4 ? "balanced" : "subtle";
  const label =
    style === "parallax"
      ? "Parallax (artwork drifts; chrome stays)"
      : style === "drift"
        ? "Drift (slow pan, tiny zoom)"
        : "Ken Burns (single-layer zoom)";
  return `${label} · ${depth} · ${duration}s loop`;
}

export function shouldPreferVideo(opts: {
  preferMotion: boolean;
  hasVideo: boolean;
  fallbackStill: boolean;
}): "video" | "image" | "none" {
  if (opts.preferMotion && opts.hasVideo) return "video";
  if (opts.fallbackStill) return "image";
  if (opts.hasVideo) return "video";
  return "none";
}
