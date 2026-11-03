import "server-only";

import type { MediaLibraryPage } from "@/application";
import { CloudinaryConfigError } from "@/infrastructure/storage/cloudinary-config";
import { reportError } from "@/infrastructure/observability/report-error";

import { requirePageSession } from "../../auth/require-page-session";
import { getMediaUseCases } from "./media-container";

export type MediaLibraryView = ({ status: "ok" } & MediaLibraryPage) | { status: "unavailable" } | { status: "error" };

/**
 * One page of the stored images with where each is used. A storage that is not configured, or that
 * does not answer (the provider's API has rate limits), is a state of the page, not a crash: the
 * rest of the admin works without it.
 */
export async function getAdminMediaLibrary(cursor: string | undefined): Promise<MediaLibraryView> {
  await requirePageSession();

  try {
    return { status: "ok", ...(await getMediaUseCases().list.execute({ cursor })) };
  } catch (error) {
    if (error instanceof CloudinaryConfigError) return { status: "unavailable" };

    console.error("Could not read the media library.", error);
    reportError(error, { area: "media-library" });
    return { status: "error" };
  }
}
