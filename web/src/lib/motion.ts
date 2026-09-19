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

export const INTENSITY_PRESETS: Record<string, number> = {
  subtle: 0.28,
  cinematic: 0.55,
  bold: 0.88,
};

export function intensityFromPreset(name: string | null | undefined): number {
  return INTENSITY_PRESETS[(name || "cinematic").toLowerCase()] ?? 0.55;
}

export function nearestMotionPreset(value: number): string {
  const intensity = clampIntensity(value);
  return Object.entries(INTENSITY_PRESETS).reduce((best, [name, amount]) =>
    Math.abs(amount - intensity) < Math.abs(INTENSITY_PRESETS[best] - intensity) ? name : best,
  "cinematic");
}

export function motionPreviewVars(
  style: MotionStyle,
  intensity: number,
  duration: number,
): Record<string, string> {
  const i = clampIntensity(intensity);
  const zoom =
    style === "kenburns" ? 1 + i * 0.16 : style === "drift" ? 1 + i * 0.055 : 1 + i * 0.12;
  const panX = style === "drift" ? i * 5.2 : i * 3.1;
  const panY = style === "drift" ? i * 1.8 : i * 1.15;
  return {
    "--motion-zoom-from": style === "parallax" ? "1.06" : "1.02",
    "--motion-zoom-to": String(zoom),
    "--motion-x": `-${panX.toFixed(2)}%`,
    "--motion-y": `${(panY * 0.4).toFixed(2)}%`,
    "--motion-duration": `${Math.max(2, duration)}s`,
  };
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
