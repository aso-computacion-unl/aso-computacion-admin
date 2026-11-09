/*
 * What a student was writing when the session ended, kept in this tab's `sessionStorage` so the sign-in that
 * brings them back to the page finds it again. Per form (`key`), only strings, each draft stored with the id of
 * the member who typed it and given back to that member only: on a shared machine the next student to sign in
 * in the same tab never gets the text of the one before, and a draft found for anyone else (or for nobody) is
 * dropped on the spot. It is also gone with the tab, with a published post and with the sign-out. Storage may
 * be unavailable (private mode, quota): then the text simply is not kept.
 */
const PREFIX = "forum-draft:";

export const threadDraftKey = (categorySlug: string) => `${PREFIX}thread:${categorySlug}`;
export const replyDraftKey = (threadId: string) => `${PREFIX}reply:${threadId}`;

/** The values `memberId` saved, only when they are exactly the fields the form has; a draft of another member, or with no member to give it to, is dropped. */
export function readDraft<V extends Record<string, string>>(key: string, fields: ReadonlyArray<keyof V & string>, memberId: string | null): V | null {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");

    if (typeof saved !== "object" || saved === null) return null;

    const { memberId: owner, values } = saved as { memberId?: unknown; values?: unknown };

    if (memberId === null || owner !== memberId) {
      window.sessionStorage.removeItem(key);

      return null;
    }

    if (typeof values !== "object" || values === null) return null;

    const saves = values as Record<string, unknown>;

    return fields.every((field) => typeof saves[field] === "string") ? (Object.fromEntries(fields.map((field) => [field, saves[field]])) as V) : null;
  } catch {
    return null;
  }
}

/** Saves the values as `memberId`'s, or forgets the draft when every field is blank; with no member nothing is kept. */
export function writeDraft(key: string, memberId: string | null, values: Record<string, string>): void {
  try {
    if (memberId === null || Object.values(values).every((value) => value.trim() === "")) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify({ memberId, values }));
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
