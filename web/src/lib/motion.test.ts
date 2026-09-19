import { describe, expect, it } from "vitest";
import { clampIntensity, defaultDuration, describeMotion, intensityFromPreset, motionPreviewVars, nearestMotionPreset, shouldPreferVideo } from "./motion";

describe("motion options", () => {
  it("clamps intensity", () => {
    expect(clampIntensity(-1)).toBe(0);
    expect(clampIntensity(2)).toBe(1);
    expect(clampIntensity(0.4)).toBe(0.4);
  });

  it("describes parallax loops", () => {
    expect(describeMotion("parallax", 0.55, 6)).toMatch(/chrome stays locked/);
    expect(describeMotion("kenburns", 0.55, 6)).toMatch(/chrome locked/);
    expect(defaultDuration("cinematic")).toBe(16);
  });

  it("selects VIDEO vs IMAGE like the plugin", () => {
    expect(shouldPreferVideo({ preferMotion: true, hasVideo: true, fallbackStill: true })).toBe("video");
    expect(shouldPreferVideo({ preferMotion: true, hasVideo: false, fallbackStill: true })).toBe("image");
    expect(shouldPreferVideo({ preferMotion: false, hasVideo: true, fallbackStill: true })).toBe("image");
    expect(shouldPreferVideo({ preferMotion: true, hasVideo: false, fallbackStill: false })).toBe("none");
    expect(shouldPreferVideo({ preferMotion: false, hasVideo: true, fallbackStill: false })).toBe("video");
  });

  it("defaults duration from quality", () => {
    expect(defaultDuration("light")).toBe(8);
    expect(defaultDuration("standard")).toBe(12);
  });

  it("maps intensity presets", () => {
    expect(intensityFromPreset("subtle")).toBe(0.16);
    expect(intensityFromPreset("bold")).toBe(0.96);
    expect(nearestMotionPreset(0.9)).toBe("bold");
    expect(nearestMotionPreset(0.3)).toBe("subtle");
  });

  it("builds CSS motion preview variables that change with intensity", () => {
    const subtle = motionPreviewVars("parallax", 0.16, 16);
    const bold = motionPreviewVars("parallax", 0.96, 10);
    expect(Number(bold["--motion-zoom-to"])).toBeGreaterThan(Number(subtle["--motion-zoom-to"]));
    expect(Math.abs(parseFloat(bold["--motion-x"]))).toBeGreaterThan(Math.abs(parseFloat(subtle["--motion-x"])));
    expect(subtle["--motion-duration"]).toBe("16s");
  });
});
