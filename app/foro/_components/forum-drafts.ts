/*
 * What a student was writing when the session ended, kept in this tab's `sessionStorage` so the sign-in that
 * brings them back to the page finds it again. Per form (`key`), only strings, and gone with the tab, with
 * a published post and with the sign-out: a draft is never left behind for the next person on the machine.
 * Storage may be unavailable (private mode, quota): then the text simply is not kept.
 */
const PREFIX = "forum-draft:";

export const threadDraftKey = (categorySlug: string) => `${PREFIX}thread:${categorySlug}`;
export const replyDraftKey = (threadId: string) => `${PREFIX}reply:${threadId}`;

/** The saved values, only when they are exactly the fields the form has (a stale or foreign value is ignored). */
export function readDraft<V extends Record<string, string>>(key: string, fields: ReadonlyArray<keyof V & string>): V | null {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");

    if (typeof saved !== "object" || saved === null) return null;

    const values = saved as Record<string, unknown>;

    return fields.every((field) => typeof values[field] === "string") ? (Object.fromEntries(fields.map((field) => [field, values[field]])) as V) : null;
  } catch {
    return null;
  }
}

/** Saves the values, or forgets the draft when every field is blank. */
export function writeDraft(key: string, values: Record<string, string>): void {
  try {
    if (Object.values(values).every((value) => value.trim() === "")) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(values));
    }
  } catch {
    // Not kept: the text is still on screen.
  }
}

export function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/** Every draft of this tab: called on sign-out. */
export function clearForumDrafts(): void {
  try {
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index));

    for (const key of keys) {
      if (key?.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
}
