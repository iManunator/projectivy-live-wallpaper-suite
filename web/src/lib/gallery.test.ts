import { describe, expect, it } from "vitest";
import { deleteAllCopy, deleteSelectedCopy, formatDeleteToast } from "./gallery";

describe("gallery delete copy", () => {
  it("builds a selected-delete confirm with count and irreversible wording", () => {
    const copy = deleteSelectedCopy([
      { id: "1", title: "From" },
      { id: "2", title: "Harbor Season", pinned: true },
    ]);
    expect(copy.empty).toBe(false);
    expect(copy.title).toBe("Delete selected?");
    expect(copy.body).toMatch(/Permanently delete 2 wallpapers/);
    expect(copy.body).toMatch(/cannot be undone/i);
    expect(copy.note).toMatch(/1 pinned wallpaper/);
    expect(copy.confirmLabel).toBe("Delete 2");
  });

  it("names a single title in the selected-delete confirm", () => {
    const copy = deleteSelectedCopy([{ id: "1", title: "From" }]);
    expect(copy.title).toBe("Delete “From”?");
    expect(copy.confirmLabel).toBe("Delete");
    expect(copy.note).toBe("");
  });

  it("skips pins by default and offers an explicit including-pins action", () => {
    const copy = deleteAllCopy([
      { id: "1", title: "From" },
      { id: "2", title: "Harbor Season", pinned: true },
      { id: "3", title: "Night Relay", hidden: true },
    ]);
    expect(copy.empty).toBe(false);
    expect(copy.body).toMatch(/Permanently delete 2 wallpapers/);
    expect(copy.body).toMatch(/never-show/);
    expect(copy.body).toMatch(/cannot be undone/i);
    expect(copy.note).toMatch(/1 pinned wallpaper will be kept/);
    expect(copy.confirmLabel).toBe("Delete 2 unpinned");
    expect(copy.extraLabel).toBe("Delete all 3 including 1 pin");
  });

  it("treats an all-pinned library as a danger-only confirm", () => {
    const copy = deleteAllCopy([{ id: "1", title: "From", pinned: true }]);
    expect(copy.confirmLabel).toBe("");
    expect(copy.extraLabel).toBe("Delete 1 including pin");
    expect(copy.body).toMatch(/pinned/);
  });

  it("marks an empty gallery so the UI can skip the dialog", () => {
    expect(deleteAllCopy([]).empty).toBe(true);
    expect(deleteSelectedCopy([]).empty).toBe(true);
  });

  it("prefers the server message for toasts", () => {
    expect(formatDeleteToast({ message: "Deleted 4 wallpapers. Kept 1 pinned wallpaper." }, "Could not delete")).toBe(
      "Deleted 4 wallpapers. Kept 1 pinned wallpaper.",
    );
    expect(formatDeleteToast({ count: 0, pinned_kept: 2 }, "Could not delete")).toMatch(/Kept 2 pinned/);
  });
});
