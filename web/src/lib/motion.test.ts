import { describe, expect, it } from "vitest";
import { clampIntensity, defaultDuration, describeMotion, shouldPreferVideo } from "./motion";

describe("motion options", () => {
  it("clamps intensity", () => {
    expect(clampIntensity(-1)).toBe(0);
    expect(clampIntensity(2)).toBe(1);
    expect(clampIntensity(0.4)).toBe(0.4);
  });

  it("describes parallax loops", () => {
    expect(describeMotion("parallax", 0.55, 6)).toMatch(/Parallax/);
    expect(defaultDuration("cinematic")).toBe(10);
  });

  it("selects VIDEO vs IMAGE like the plugin", () => {
    expect(shouldPreferVideo({ preferMotion: true, hasVideo: true, fallbackStill: true })).toBe("video");
    expect(shouldPreferVideo({ preferMotion: true, hasVideo: false, fallbackStill: true })).toBe("image");
    expect(shouldPreferVideo({ preferMotion: false, hasVideo: true, fallbackStill: true })).toBe("image");
    expect(shouldPreferVideo({ preferMotion: true, hasVideo: false, fallbackStill: false })).toBe("none");
    expect(shouldPreferVideo({ preferMotion: false, hasVideo: true, fallbackStill: false })).toBe("video");
  });

  it("defaults duration from quality", () => {
    expect(defaultDuration("light")).toBe(6);
    expect(defaultDuration("standard")).toBe(8);
  });
});
