import "server-only";

import type { OrphanScan } from "@/application";
import { reportError } from "@/infrastructure/observability/report-error";
import { CloudinaryConfigError } from "@/infrastructure/storage/cloudinary-config";

import { requirePageSession } from "../../auth/require-page-session";
import { getMediaUseCases } from "./media-container";

export type OrphanScanView = ({ status: "ok" } & OrphanScan) | { status: "unavailable" } | { status: "error" };

/** The dry run of the cleanup: one page of the storage and which of its images nothing uses. ADMIN only; deletes nothing. */
export async function getAdminOrphanScan(cursor: string | undefined): Promise<OrphanScanView> {
  await requirePageSession("ADMIN");

  try {
    return { status: "ok", ...(await getMediaUseCases().findOrphans.execute({ cursor })) };
  } catch (error) {
    if (error instanceof CloudinaryConfigError) return { status: "unavailable" };

    console.error("Could not scan the media library for unused images.", error);
    reportError(error, { area: "media-orphans" });
    return { status: "error" };
  }
}
