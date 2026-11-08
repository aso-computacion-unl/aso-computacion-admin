import { describe, expect, it } from "vitest";

import { REGISTRATION_REDIRECTS } from "@/infrastructure/http/registration-redirects";

/** What Next does with a redirect: the first rule whose source matches the path gives the destination (`:name` is one path segment). */
function resolve(path: string): { destination: string; permanent: boolean } | null {
  for (const rule of REGISTRATION_REDIRECTS) {
    const names: string[] = [];
    const pattern = new RegExp(`^${rule.source.replace(/:(\w+)/g, (_all, name: string) => (names.push(name), "([^/]+)"))}$`);
    const found = pattern.exec(path);

    if (found) {
      return { destination: rule.destination.replace(/:(\w+)/g, (_all, name: string) => found[names.indexOf(name) + 1] ?? ""), permanent: rule.permanent };
    }
  }

  return null;
}

describe("the old registration address /foro/eventos/<slug>", () => {
  it("is a permanent redirect (308) to /inscripciones/<slug>", () => {
    expect(resolve("/foro/eventos/x")).toEqual({ destination: "/inscripciones/x", permanent: true });
    expect(resolve("/foro/eventos/taller-de-git")).toEqual({ destination: "/inscripciones/taller-de-git", permanent: true });
  });

  it("keeps an encoded slug as it came", () => {
    expect(resolve("/foro/eventos/a%20b")?.destination).toBe("/inscripciones/a%20b");
  });

  it("leaves the query to Next, which appends the request's own query string to a destination that has none", () => {
    // /foro/eventos/x?y=1 answers 308 with `Location: /inscripciones/x?y=1`; a query in the rule would replace it.
    for (const rule of REGISTRATION_REDIRECTS) expect(rule.destination).not.toContain("?");
  });

  it.each(["/foro/eventos", "/foro/eventos/", "/foro/eventos/x/y", "/foro/hilo/x", "/foro", "/inscripciones/x"])("does not redirect %s", (path) => {
    expect(resolve(path)).toBeNull();
  });
});
