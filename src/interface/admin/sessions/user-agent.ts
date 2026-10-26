const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux|X11/, "Linux"],
];

const first = (table: [RegExp, string][], agent: string) => table.find(([pattern]) => pattern.test(agent))?.[1];

/** "Chrome en Linux": enough to tell one's own devices apart in the session list, nothing more precise. */
export function describeUserAgent(agent: string | null): string {
  const browser = agent ? first(BROWSERS, agent) : undefined;
  const system = agent ? first(SYSTEMS, agent) : undefined;

  if (browser && system) return `${browser} en ${system}`;

  return browser ?? system ?? "Dispositivo desconocido";
}
