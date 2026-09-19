import type { AppSettings, GenerateRequest, Layout, WallpaperRecord } from "./layout";

async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export const api = {
  layouts: () => json<string[]>("/api/layouts/list"),
  layout: (name: string) => json<Layout>(`/api/layouts/load/${encodeURIComponent(name)}`),
  saveLayout: (layout: Layout) =>
    json<{ status: string }>("/api/layouts/save", { method: "POST", body: JSON.stringify(layout) }),
  gallery: (layout?: string) =>
    json<WallpaperRecord[]>(layout ? `/api/gallery?layout=${encodeURIComponent(layout)}` : "/api/gallery"),
  settings: () => json<AppSettings>("/api/settings"),
  saveSettings: (settings: AppSettings) =>
    json("/api/settings", { method: "POST", body: JSON.stringify(settings) }),
  generate: (body: GenerateRequest) =>
    json("/api/generate", { method: "POST", body: JSON.stringify(body) }),
  generateMotion: (layout: string) =>
    json(`/api/wallpaper/generate-motion?layout=${encodeURIComponent(layout)}`, { method: "POST" }),
  options: () => json<Record<string, unknown>>("/api/options"),
  media: (source: string, limit = 12) =>
    json<Array<Record<string, unknown>>>(`/api/media?source=${encodeURIComponent(source)}&limit=${limit}`),
  mediaArtwork: (itemId: string, kind = "backdrop") =>
    `/api/media/artwork/${encodeURIComponent(itemId)}?kind=${encodeURIComponent(kind)}`,
  testProvider: (name: string) => json(`/api/settings/test/${name}`, { method: "POST" }),
  wallpaperImage: (layout: string, filename: string) =>
    `/api/wallpaper/image/${encodeURIComponent(layout)}/${encodeURIComponent(filename)}`,
  flag: (id: string, body: { pinned?: boolean; hidden?: boolean }) =>
    json<{ status: string; record: WallpaperRecord }>(`/api/gallery/${encodeURIComponent(id)}/flag`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  tonight: (layout: string, exclude?: string) => {
    const params = new URLSearchParams({ layout });
    if (exclude) params.set("exclude", exclude);
    return json<{
      status: Record<string, unknown>;
      queues: Array<{ id: string; label: string; count: number; titles: string[] }>;
      profile: string;
      motion: Record<string, unknown>;
    }>(`/api/tonight?${params.toString()}`);
  },
  dashboard: () => json<Record<string, unknown>>("/api/dashboard"),
  queues: (layout?: string) =>
    json<Array<{ id: string; label: string; count: number; titles: string[] }>>(
      layout ? `/api/queues?layout=${encodeURIComponent(layout)}` : "/api/queues",
    ),
};
