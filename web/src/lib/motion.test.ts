import { describe, expect, it } from "vitest";
import { clampIntensity, defaultDuration, describeMotion, intensityFromPreset, motionPreviewVars, nearestMotionPreset, shouldPreferVideo } from "./motion";

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

  it("maps intensity presets", () => {
    expect(intensityFromPreset("subtle")).toBe(0.28);
    expect(intensityFromPreset("bold")).toBe(0.88);
    expect(nearestMotionPreset(0.9)).toBe("bold");
    expect(nearestMotionPreset(0.3)).toBe("subtle");
  });

  it("builds CSS motion preview variables", () => {
    const vars = motionPreviewVars("parallax", 0.88, 6);
    expect(Number(vars["--motion-zoom-to"])).toBeGreaterThan(1.05);
    expect(vars["--motion-duration"]).toBe("6s");
  });
});
