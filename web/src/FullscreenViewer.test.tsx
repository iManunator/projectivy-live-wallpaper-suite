import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FullscreenViewer, type ViewerItem } from "./FullscreenViewer";
import { ToastProvider } from "./toasts";

vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({
    ok: true,
    json: async () => ({
      motion_style: "parallax",
      motion_preset: "cinematic",
      motion_intensity: 0.55,
      motion_duration: 12,
      light_leak: true,
      motion_vary: true,
      motion_quality: "light",
    }),
    text: async () => "{}",
  })),
);

const stillItem: ViewerItem = {
  id: "1",
  src: "/api/wallpaper/image/Netflix%20Hero/from.jpg",
  stillSrc: "/api/wallpaper/image/Netflix%20Hero/from.jpg",
  title: "From",
  subtitle: "2022 · Netflix Hero",
  watchState: "unwatched",
  artworkSrc: "/api/media/artwork/demo-jf-1?kind=backdrop",
  plateSrc: "/api/wallpaper/image/Netflix%20Hero/from_plate.jpg",
  artCandidates: ["/api/media/artwork/demo-jf-1?kind=backdrop", "/api/wallpaper/image/Netflix%20Hero/from_plate.jpg", "/api/wallpaper/image/Netflix%20Hero/from.jpg"],
  hasVideo: false,
  videoSrc: null,
};

const videoItem: ViewerItem = {
  ...stillItem,
  id: "6",
  title: "Night Relay",
  src: "/api/wallpaper/image/Prime%20Cinematic/relay.jpg",
  stillSrc: "/api/wallpaper/image/Prime%20Cinematic/relay.jpg",
  videoSrc: "/api/wallpaper/image/Prime%20Cinematic/relay.mp4",
  hasVideo: true,
  artworkSrc: "/api/media/artwork/demo-jf-6?kind=backdrop",
  plateSrc: "/api/wallpaper/image/Prime%20Cinematic/relay_plate.jpg",
  artCandidates: ["/api/media/artwork/demo-jf-6?kind=backdrop"],
};

function renderViewer(item: ViewerItem) {
  return render(
    <ToastProvider>
      <FullscreenViewer items={[item]} index={0} onClose={() => undefined} onIndex={() => undefined} />
    </ToastProvider>,
  );
}

async function ready(title: string) {
  return screen.findByRole("dialog", { name: new RegExp(`${title} full screen`, "i") });
}

describe("gallery lightbox motion", () => {
  it("plays a baked sibling MP4 when has_video, without Ken-Burning the composite", async () => {
    const { container } = renderViewer(videoItem);
    const dialog = await ready("Night Relay");
    const video = container.querySelector("video") as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toMatch(/relay\.mp4$/);
    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(container.querySelector(".motion-art")).toBeNull();
    expect(within(dialog).getByText("VIDEO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close full screen" })).toBeInTheDocument();
  });

  it("uses layered CSS motion for a still-only item (plate/artwork moves, chrome stays locked)", async () => {
    const { container } = renderViewer(stillItem);
    await ready("From");
    const art = screen.getByRole("img", { name: /From artwork/i });
    expect(art.className).toMatch(/motion-art/);
    expect(art.closest(".stage-bg")).toBeTruthy();
    expect(art.getAttribute("src") || "").toMatch(/artwork/);
    expect(art.getAttribute("src") || "").not.toMatch(/from\.jpg$/);
    const locked = screen.getAllByText("From").find((node) => node.className.includes("sample-title"));
    expect(locked?.closest(".stage-fg")).toBeTruthy();
    expect(locked?.closest(".stage-bg")).toBeNull();
    expect(within(screen.getByRole("dialog")).getByText("Motion preview")).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
  });

  it("shows Seerr-only chrome next to the watch pill on layered lightbox chrome", async () => {
    renderViewer({
      ...stillItem,
      libraryState: "seerr_only",
      availability: "requestable",
      source: "jellyseerr",
    });
    await ready("From");
    expect(screen.getAllByText("Unwatched").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Seerr only").length).toBeGreaterThan(0);
  });

  it("falls back to the CSS preview and toasts when VIDEO fails to load", async () => {
    const { container } = renderViewer(videoItem);
    await ready("Night Relay");
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    fireEvent.error(video as HTMLVideoElement);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not play VIDEO/);
    expect(container.querySelector("video")).toBeNull();
    const art = screen.getByRole("img", { name: /Night Relay artwork/i });
    expect(art.className).toMatch(/motion-art/);
    expect(within(screen.getByRole("dialog")).getByText("Motion preview")).toBeInTheDocument();
  });
});
