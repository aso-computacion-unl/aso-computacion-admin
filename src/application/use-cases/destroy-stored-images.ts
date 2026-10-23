import type { MediaStoragePort } from "../ports/media-storage.port";

/**
 * Best-effort cleanup that runs AFTER the database write succeeded: a failed
 * destroy never fails the operation. Every `publicId` that could not be
 * destroyed is logged, with the reasons, so it can be removed by hand.
 */
export async function destroyStoredImages(
  storage: MediaStoragePort,
  publicIds: readonly string[],
  context: string,
): Promise<void> {
  const outcomes = await Promise.allSettled(publicIds.map((publicId) => storage.destroy(publicId)));
  const leftover = publicIds.filter((_, index) => outcomes[index]?.status === "rejected");

  if (leftover.length > 0) {
    const reasons = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
    console.error(`${context}, but could not destroy its stored images: ${leftover.join(", ")}`, reasons);
  }
}
