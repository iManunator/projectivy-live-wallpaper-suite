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
  media: (source: string) => json<Array<Record<string, unknown>>>(`/api/media?source=${source}`),
  testProvider: (name: string) => json(`/api/settings/test/${name}`, { method: "POST" }),
  wallpaperImage: (layout: string, filename: string) =>
    `/api/wallpaper/image/${encodeURIComponent(layout)}/${encodeURIComponent(filename)}`,
};
