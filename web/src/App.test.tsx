import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    let body: unknown = [];
    if (url.includes("/api/gallery")) body = [];
    if (url.includes("/api/layouts/list")) body = ["Netflix Hero", "Projectivy Dock"];
    if (url.includes("/api/layouts/load")) {
      body = {
        name: "Netflix Hero",
        canvas_width: 1920,
        canvas_height: 1080,
        background: {
          mode: "backdrop",
          color: "#000",
          fade_left: 0.4,
          fade_right: 0.05,
          fade_top: 0.08,
          fade_bottom: 0.3,
          fade_softness: 0.4,
          brightness: 1,
        },
        layers: [],
      };
    }
    if (url.includes("/api/tonight")) {
      body = {
        status: {
          title: "Northlight",
          imageUrl: "/api/wallpaper/image/Netflix%20Hero/northlight.jpg",
          mediaType: "image",
          queue: "unwatched",
          pinned: false,
        },
        queues: [
          { id: "unwatched", label: "Unwatched", count: 2, titles: ["Northlight"] },
          { id: "continue_watching", label: "Continue watching", count: 1, titles: ["Harbor Season"] },
        ],
        profile: "tonight",
        motion: { style: "parallax", preset: "cinematic", intensity: 0.55, light_leak: true },
      };
    }
    if (url.includes("/api/dashboard")) {
      body = {
        ok: true,
        gallery: { count: 6, videos: 1, pinned: 0, hidden: 0 },
        cron: { jobs: 0, last: null, last_generate: null },
        providers: { demo: { configured: true } },
        motion: { preset: "cinematic", style: "parallax" },
        taste: { profile: "tonight" },
      };
    }
    if (url.includes("/api/settings")) {
      body = {
        public_base_url: "http://127.0.0.1:8787",
        timezone: "UTC",
        motion_wallpapers: false,
        motion_quality: "light",
        motion_style: "parallax",
        motion_intensity: 0.55,
        motion_duration: null,
        motion_fps: 24,
        overwrite_existing: false,
        editor_theme: "cinema",
        motion_preset: "cinematic",
        light_leak: true,
        taste_profile: "tonight",
        overlays_enabled: false,
        jellyfin: {},
        jellyseerr: {},
        tmdb: {},
        cron_jobs: [],
      };
    }
    return {
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }),
);

describe("App smoke", () => {
  it("renders tonight preview and can open the gallery", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /home screen/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wallpaparr" })).toBeInTheDocument();
    expect(screen.getAllByText("Northlight").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    expect(await screen.findByRole("heading", { name: "Gallery" })).toBeInTheDocument();
    expect(screen.getByText(/0 wallpapers/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Health" })).toBeInTheDocument();
  });
});
