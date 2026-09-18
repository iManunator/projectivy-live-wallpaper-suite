import type { WallpaperRecord } from "./layout";

export const QUEUE_LABELS: Record<string, string> = {
  unwatched: "Unwatched",
  continue_watching: "Continue watching",
  newly_added: "Newly added",
  seerr_trending: "Seerr trending",
  requestable: "Requestable",
  pinned: "Pinned",
};

export const TASTE_PRESETS: Record<string, Record<string, number>> = {
  tonight: { unwatched: 50, newly_added: 30, requestable: 20 },
  unwatched_heavy: { unwatched: 70, continue_watching: 20, newly_added: 10 },
  cinephile: { unwatched: 40, newly_added: 20, seerr_trending: 40 },
  discovery: { requestable: 50, seerr_trending: 50 },
};

export const LAYOUT_DNA = [
  { name: "Netflix Hero", blurb: "Left-stacked hero over a heavy fade" },
  { name: "Prime Cinematic", blurb: "Low title card, deep bottom gradient" },
  { name: "Google TV Clean", blurb: "Minimal chrome, artwork breathing room" },
  { name: "Projectivy Dock", blurb: "Safe zones below the clock, above the row dock" },
];

export function queueBadges(record: Pick<WallpaperRecord, "watch_state" | "library_state" | "source" | "pinned" | "hidden" | "has_video"> & { availability?: string }): string[] {
  const badges: string[] = [];
  const watch = (record.watch_state || "").toLowerCase();
  const library = (record.library_state || "").toLowerCase();
  const availability = (record.availability || "").toLowerCase();
  const source = (record.source || "").toLowerCase();
  if (record.pinned) badges.push("Pinned");
  if (record.hidden) badges.push("Never show");
  if (watch === "unwatched" || watch === "unplayed") badges.push("Unwatched");
  if (["partial", "partially_watched", "inprogress", "in_progress"].includes(watch)) badges.push("Continue");
  if (availability === "requestable" || availability === "not_available" || library === "seerr_only") {
    badges.push("Requestable");
  }
  if (source === "jellyseerr" || source === "seerr") badges.push("Seerr");
  if (record.has_video) badges.push("VIDEO");
  return badges;
}

export function formatOpsTime(at: number | null | undefined): string {
  if (!at) return "never";
  const delta = Date.now() / 1000 - at;
  if (delta < 90) return "just now";
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}
