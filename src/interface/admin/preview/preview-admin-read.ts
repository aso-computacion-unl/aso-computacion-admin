import "server-only";

import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { isPreviewConfigured } from "@/infrastructure/preview/preview-token";

import { requirePageSession } from "../../auth/require-page-session";
import { PREVIEW_ENDPOINT_PATH } from "./preview-paths";

/** What the preview page needs to know before it offers to generate a token. */
export async function getPreviewSetup() {
  await requirePageSession();
  const origin = publicOrigin(process.env.AUTH_URL);

  return { configured: isPreviewConfigured(), endpoint: origin ? `${origin}${PREVIEW_ENDPOINT_PATH}` : null };
}
