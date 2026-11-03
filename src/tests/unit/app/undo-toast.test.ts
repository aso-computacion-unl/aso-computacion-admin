import { describe, expect, it, vi } from "vitest";

import { RESTORED_MESSAGE, UNDO_LABEL, undoAction } from "../../../../app/admin/_components/undo-toast";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("undoAction", () => {
  it("is a button labelled Deshacer", () => {
    expect(undoAction(async () => ({ success: true }), vi.fn()).label).toBe(UNDO_LABEL);
    expect(UNDO_LABEL).toBe("Deshacer");
  });

  it("restores the item when pressed and confirms it", async () => {
    const undo = vi.fn(async () => ({ success: true as const }));
    const notify = vi.fn();

    undoAction(undo, notify).onAction();
    await settle();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(RESTORED_MESSAGE);
  });

  it("does nothing until it is pressed", () => {
    const undo = vi.fn(async () => ({ success: true as const }));

    undoAction(undo, vi.fn());

    expect(undo).not.toHaveBeenCalled();
  });

  it("announces the server's reason when the restore is refused", async () => {
    const notify = vi.fn();

    undoAction(async () => ({ error: "No se puede restaurar: el identificador «x» ya lo usa otro evento." }), notify).onAction();
    await settle();

    expect(notify).toHaveBeenCalledWith("No se puede restaurar: el identificador «x» ya lo usa otro evento.");
  });

  it("announces a generic failure when the call itself rejects or gives no reason", async () => {
    const notify = vi.fn();

    undoAction(async () => Promise.reject(new Error("offline")), notify).onAction();
    undoAction(async () => ({}), notify).onAction();
    await settle();

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, "No se pudo deshacer. Revise la papelera.");
    expect(notify).toHaveBeenNthCalledWith(2, "No se pudo deshacer. Revise la papelera.");
  });

  it("runs the restore at most once, even when pressed again while it is pending or after it settled", async () => {
    let finish: (result: { success: true }) => void = () => undefined;
    const undo = vi.fn(() => new Promise<{ success: true }>((resolve) => (finish = resolve)));
    const notify = vi.fn();
    const action = undoAction(undo, notify);

    action.onAction();
    action.onAction();
    finish({ success: true });
    await settle();
    action.onAction();
    await settle();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
