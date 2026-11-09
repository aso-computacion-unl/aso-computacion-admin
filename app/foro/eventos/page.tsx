import { permanentRedirect } from "next/navigation";

type Param = string | string[] | undefined;

// The page of the registrations list was the forum's; it is now `/inscripciones`, a section of its own (D8).
// It is rendered per request, so the query string is read here to be kept.
export const dynamic = "force-dynamic";

/**
 * `/foro/eventos` answers a permanent redirect (308) to `/inscripciones`, keeping the query string, so the addresses
 * already shared (the old forum link, bookmarks) keep working. `/foro/eventos/<slug>` is redirected the same way by
 * `next.config.ts` (`REGISTRATION_REDIRECTS`).
 */
export default async function ForumRegistrationsRedirect({ searchParams }: { searchParams: Promise<Record<string, Param>> }): Promise<never> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }

  const search = query.toString();

  permanentRedirect(search ? `/inscripciones?${search}` : "/inscripciones");
}
