/**
 * The landing is rebuilt when a save changes what it shows. A row that was a draft before the save and
 * stays a draft is not on the site, so saving it (autosave included) needs no rebuild; Historial still
 * records the edit. Publishing, unpublishing and any save of a published row do rebuild.
 *
 * `wasPublished` must come from the stored row read before the save, never from client input.
 */
export function shouldRebuildSite(wasPublished: boolean, isPublished: boolean): boolean {
  return wasPublished || isPublished;
}
