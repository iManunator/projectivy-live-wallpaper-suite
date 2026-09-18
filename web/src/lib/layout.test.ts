import { describe, expect, it } from "vitest";
import { duplicateLayout, emptyLayout, validateLayout } from "../lib/layout";
import { shouldSkipExisting } from "../lib/skip";
import { buildStatusQuery, parseYearRange, rememberShownPath } from "../lib/wallpaperQuery";

describe("layout validation", () => {
  it("accepts a named layout with layers", () => {
    expect(validateLayout(emptyLayout("Hero"))).toEqual([]);
  });

  it("rejects blank names and empty layers", () => {
    const layout = emptyLayout(" ");
    layout.name = " ";
    layout.layers = [];
    expect(validateLayout(layout).join(" ")).toMatch(/name/i);
  });

  it("duplicateLayout clears preset flags", () => {
    const copy = duplicateLayout({ ...emptyLayout("A"), preset: true, preset_id: "a" }, "B");
    expect(copy.name).toBe("B");
    expect(copy.preset).toBe(false);
  });
});

describe("wallpaper query builder", () => {
  it("encodes Projectivy status params", () => {
    const url = buildStatusQuery({
      layout: "Netflix Hero",
      sort: "latest",
      pool: "unwatched",
      genre: "Sci-Fi",
      exclude: "northlight.jpg",
    });
    expect(url).toContain("/api/wallpaper/status?");
    expect(url).toContain("layout=Netflix+Hero");
    expect(url).toContain("sort=latest");
    expect(url).toContain("pool=unwatched");
    expect(url).toContain("exclude=northlight.jpg");
  });

  it("parses year ranges", () => {
    expect(parseYearRange("2005-2010")).toEqual({ min: "2005", max: "2010" });
    expect(parseYearRange("2024")).toEqual({ min: "2024", max: "2024" });
  });

  it("keeps a no-repeat bag of recent paths", () => {
    expect(rememberShownPath(["a.jpg", "b.jpg"], "c.jpg", 2)).toEqual(["c.jpg", "a.jpg"]);
  });
});

describe("skip existing by media id", () => {
  it("skips matching jellyfin ids", () => {
    expect(
      shouldSkipExisting([{ title: "Old", jellyfin_id: "jf-1" }], { title: "New", jellyfin_id: "jf-1" }, true),
    ).toBe(true);
  });

  it("does not skip when disabled", () => {
    expect(
      shouldSkipExisting([{ title: "Old", jellyfin_id: "jf-1" }], { title: "New", jellyfin_id: "jf-1" }, false),
    ).toBe(false);
  });
});
