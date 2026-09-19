import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    let body: unknown = [];
    if (url.includes("/api/gallery")) {
      body = [
        {
          id: "1",
          layout: "Netflix Hero",
          filename: "from.jpg",
          title: "From",
          year: 2022,
          rating: 8.5,
          genres: ["Horror"],
          official_rating: "TV-MA",
          watch_state: "unwatched",
          library_state: "in_library",
          source: "jellyfin",
          has_video: false,
        },
      ];
    }
    if (url.includes("/api/media?")) {
      if (url.includes("jellyfin")) {
        body = [
          {
            title: "From",
            year: 2022,
            overview: "A town that will not let you leave.",
            rating: 8.5,
            genres: ["Horror", "Drama"],
            official_rating: "TV-MA",
            runtime: "52m",
            watch_state: "unwatched",
            source: "jellyfin",
            jellyfin_id: "from1",
            backdrop_url: "http://jf:8096/Items/from1/Images/Backdrop",
          },
        ];
      } else {
        body = [
          {
            title: "Northlight",
            year: 2024,
            overview: "A cartographer maps a city that rearranges itself after dusk.",
            rating: 8.4,
            genres: ["Sci-Fi", "Mystery"],
            official_rating: "PG-13",
            runtime: "2h 11m",
            watch_state: "unwatched",
            source: "jellyfin",
            jellyfin_id: "demo-jf-1",
          },
        ];
      }
    }
    if (url.includes("/api/settings/test/")) {
      body = { ok: true, message: "Connected to Jellyfin (Living Room)", server: "Living Room" };
    }
    if (url.includes("/api/generate")) {
      body = { count: 2, created: ["Northlight", "Harbor Season"], message: "Created 2 stills for Netflix Hero (Northlight, Harbor Season)." };
    }
    if (url.includes("/api/wallpaper/generate-motion")) {
      body = {
        status: "ok",
        generated: ["northlight.jpg"],
        count: 1,
        style: "parallax",
        message: "Baked parallax VIDEO for northlight.jpg on Netflix Hero (cinematic).",
      };
    }
    if (url.includes("/api/cron/run")) {
      body = { count: 1, created: ["Northlight"], message: "Created 1 still for Netflix Hero (Northlight)." };
    }
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
          gradient_type: "linear",
          gradient_angle: 90,
          gradient_opacity: 0.4,
          gradient_stops: [],
          vignette: 0.1,
          overlay_color: "#000000",
          overlay_opacity: 0,
        },
        layers: [
          {
            id: "title",
            slot: "title",
            x: 80,
            y: 80,
            font_size: 64,
            color: "#ffffff",
            font_weight: "bold",
            visible: true,
            align: "left",
          },
        ],
        title_display: "auto",
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
          path: "northlight.jpg",
          watchState: "unwatched",
        },
        queues: [
          { id: "unwatched", label: "Unwatched", count: 2, titles: ["Northlight"] },
          { id: "continue_watching", label: "Continue watching", count: 1, titles: ["Harbor Season"] },
        ],
        profile: "tonight",
        motion: { style: "parallax", preset: "cinematic", intensity: 0.55, light_leak: true },
        preview: { artworkUrl: "/api/media/artwork/demo-jf-1", itemId: "demo-jf-1", layered: true },
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
    if (url.includes("/api/settings") && !url.includes("/api/settings/test/")) {
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
        title_display: "auto",
      };
    }
    return {
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }),
);

class ProbeImage {
  onload: ((ev?: Event) => void) | null = null;
  onerror: ((ev?: Event) => void) | null = null;
  naturalWidth = 900;
  naturalHeight = 140;
  set src(value: string) {
    const ok = String(value).includes("demo-jf-1");
    queueMicrotask(() => {
      if (ok) this.onload?.(new Event("load"));
      else this.onerror?.(new Event("error"));
    });
  }
}
vi.stubGlobal("Image", ProbeImage);

describe("App smoke", () => {
  it("renders tonight preview and can open the gallery", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /home screen/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wallpaparr" })).toBeInTheDocument();
    expect(screen.getAllByText("Northlight").length).toBeGreaterThan(0);
    const tonightStage = screen.getByLabelText("Projectivy home screen preview");
    const tonightArt = tonightStage.querySelector("img");
    expect(tonightArt?.className).toMatch(/motion-art/);
    expect(tonightArt?.getAttribute("src") || "").toMatch(/artwork/);
    expect(tonightStage.querySelector(".tv-hero-meta")?.closest(".stage-fg")).toBeTruthy();
    expect(tonightArt?.closest(".stage-bg")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bake motion for tonight/i })).toBeInTheDocument();
    expect(screen.getAllByText("Unwatched").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
    expect(await screen.findByRole("heading", { name: "Gallery" })).toBeInTheDocument();
    expect(screen.getByText(/1 wallpapers/)).toBeInTheDocument();
    expect(screen.getAllByText("Unwatched").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /View From full screen/i }));
    expect(screen.getByRole("dialog", { name: /From full screen/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close full screen" }));
    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    expect(await screen.findByRole("heading", { name: "Layout editor" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /Northlight artwork/i })).toBeInTheDocument();
    const art = screen.getByRole("img", { name: /Northlight artwork/i });
    expect(art.className).toMatch(/motion-art/);
    expect(art.closest(".stage-bg")).toBeTruthy();
    expect(document.querySelector(".stage-frame.editor-stage")).toBeTruthy();
    expect(screen.getByLabelText("Demo preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Title display")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /Northlight logo/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Northlight logo/i }).closest(".stage-fg")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Title display"), { target: { value: "text" } });
    expect(screen.queryByRole("img", { name: /Northlight logo/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Gradient type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Motion on" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bake motion for this layout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status Focus" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("heading", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByText(/Skip leaves titles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run batch" }));
    expect((await screen.findAllByText(/Created 2 stills/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Bake motion for tonight’s pick" }));
    expect((await screen.findAllByText(/Baked parallax VIDEO/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Health" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText(/Taste profile/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Default title display")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Overlay widgets/i })).toBeInTheDocument();
    expect(screen.getByText(/Intensity preset/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Cron layout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect((await screen.findAllByText(/Created 1 still/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Test Jellyfin" }));
    expect((await screen.findAllByText(/Connected to Jellyfin/)).length).toBeGreaterThan(0);
  });
});
