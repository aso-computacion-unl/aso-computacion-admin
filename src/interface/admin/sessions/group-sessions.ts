export interface GroupableSession {
  id: string;
  userId: string | null;
  kind: "user" | "break_glass";
  userName: string | null;
  userEmail: string | null;
  isCurrent: boolean;
}

export interface SessionGroup<T extends GroupableSession> {
  /** Null for the emergency login, which is not a person. */
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  sessions: T[];
  /** The group holding this browser's session. */
  isOwn: boolean;
  /** What "Cerrar las demás" would close: every session of a person except the current one. Never for the emergency group. */
  closableOthers: number;
}

/** One group per person (the emergency login is its own group), the viewer's first; order inside and between groups is the incoming one. */
export function groupSessionsByPerson<T extends GroupableSession>(sessions: T[]): SessionGroup<T>[] {
  const groups = new Map<string, SessionGroup<T>>();

  for (const session of sessions) {
    const key = session.userId ?? "break_glass";
    let group = groups.get(key);

    if (!group) {
      group = { userId: session.userId, userName: session.userName, userEmail: session.userEmail, sessions: [], isOwn: false, closableOthers: 0 };
      groups.set(key, group);
    }

    group.sessions.push(session);
    group.isOwn ||= session.isCurrent;
  }

  for (const group of groups.values()) {
    group.closableOthers = group.userId === null ? 0 : group.sessions.filter((session) => !session.isCurrent).length;
  }

  return [...groups.values()].sort((a, b) => Number(b.isOwn) - Number(a.isOwn));
}
