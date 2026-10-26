import { describe, expect, it } from "vitest";

import { dismissToast, MAX_TOASTS, pushToast } from "@/interface/admin/toasts";

describe("pushToast", () => {
  it("appends the toast with its id", () => {
    expect(pushToast([], { id: 1, message: "Publicado." })).toEqual([{ id: 1, message: "Publicado." }]);
  });

  it("keeps only the newest toasts once the limit is reached", () => {
    let toasts = pushToast([], { id: 0, message: "m0" });

    for (let id = 1; id <= MAX_TOASTS; id += 1) {
      toasts = pushToast(toasts, { id, message: `m${id}` });
    }

    expect(toasts).toHaveLength(MAX_TOASTS);
    expect(toasts[0]?.id).toBe(1);
    expect(toasts.at(-1)?.id).toBe(MAX_TOASTS);
  });

  it("does not mutate the previous list", () => {
    const previous = [{ id: 1, message: "a" }];

    pushToast(previous, { id: 2, message: "b" });

    expect(previous).toEqual([{ id: 1, message: "a" }]);
  });
});

describe("dismissToast", () => {
  it("removes only the toast with that id", () => {
    const toasts = [
      { id: 1, message: "a" },
      { id: 2, message: "b" },
    ];

    expect(dismissToast(toasts, 1)).toEqual([{ id: 2, message: "b" }]);
  });

  it("ignores an id that is already gone (the timer and the close button can race)", () => {
    const toasts = [{ id: 1, message: "a" }];

    expect(dismissToast(toasts, 9)).toEqual(toasts);
  });
});
