export type Layer = {
  id: string;
  slot: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  font_size: number;
  color: string;
  font_weight: string;
  max_items?: number | null;
  visible: boolean;
  align: string;
};

export type Layout = {
  name: string;
  canvas_width: number;
  canvas_height: number;
  background: {
    mode: string;
    color: string;
    fade_left: number;
    fade_right: number;
    fade_top: number;
    fade_bottom: number;
    fade_softness: number;
    brightness: number;
  };
  layers: Layer[];
  preset?: boolean;
  preset_id?: string | null;
  description?: string;
};

export type WallpaperRecord = {
  id: string;
  layout: string;
  filename: string;
  title: string;
  year?: number | null;
  rating: number;
  genres: string[];
  official_rating: string;
  watch_state: string;
  library_state: string;
  source: string;
  has_video: boolean;
  parallax_style?: string | null;
  action_url?: string | null;
};

export type CronJob = {
  enabled?: boolean;
  cron?: string;
  layout?: string;
  source?: string;
  skip_existing?: boolean;
  replace_existing?: boolean;
  cleanup?: boolean;
  motion?: boolean;
  limit?: number;
  ids?: string[] | string;
  skip_ids?: string[] | string;
};

export type AppSettings = {
  public_base_url: string;
  timezone: string;
  motion_wallpapers: boolean;
  motion_quality: string;
  motion_style: string;
  motion_intensity: number;
  motion_duration: number | null;
  motion_fps: number;
  overwrite_existing: boolean;
  editor_theme: string;
  jellyfin: Record<string, string>;
  jellyseerr: Record<string, string>;
  tmdb: Record<string, string>;
  cron_jobs: CronJob[];
};

export type GenerateRequest = {
  layout: string;
  source: string;
  limit: number;
  skip_existing: boolean;
  replace_existing: boolean;
  cleanup: boolean;
  motion: boolean;
  ids?: string[];
  skip_ids?: string[];
};

export const SLOTS = [
  "title",
  "year",
  "genres",
  "runtime",
  "rating",
  "overview",
  "watch_status",
  "source",
  "age",
] as const;

export function emptyLayout(name = "Untitled"): Layout {
  return {
    name,
    canvas_width: 1920,
    canvas_height: 1080,
    background: {
      mode: "backdrop",
      color: "#050505",
      fade_left: 0.42,
      fade_right: 0.05,
      fade_top: 0.08,
      fade_bottom: 0.38,
      fade_softness: 0.45,
      brightness: 1,
    },
    layers: [
      {
        id: "title",
        slot: "title",
        x: 80,
        y: 80,
        width: 860,
        font_size: 64,
        color: "#ffffff",
        font_weight: "bold",
        visible: true,
        align: "left",
      },
    ],
  };
}

export function validateLayout(layout: Layout): string[] {
  const errors: string[] = [];
  if (!layout.name.trim()) errors.push("Layout name is required");
  if (layout.canvas_width < 1280 || layout.canvas_height < 720) {
    errors.push("Canvas must be at least 1280×720");
  }
  if (!layout.layers.length) errors.push("Add at least one layer");
  const ids = new Set<string>();
  for (const layer of layout.layers) {
    if (!layer.id.trim()) errors.push("Every layer needs an id");
    if (ids.has(layer.id)) errors.push(`Duplicate layer id: ${layer.id}`);
    ids.add(layer.id);
    if (layer.x < 0 || layer.y < 0) errors.push(`Layer ${layer.id} is off-canvas`);
  }
  return errors;
}

export function duplicateLayout(layout: Layout, newName: string): Layout {
  return {
    ...layout,
    name: newName,
    preset: false,
    preset_id: null,
  };
}
