import "server-only";

import { ListPreviewCodesUseCase } from "@/application/audit/list-preview-codes.use-case";
import { publicOrigin } from "@/infrastructure/auth/auth-config";
import { PREVIEW_TOKEN_TTL_SECONDS, isPreviewConfigured } from "@/infrastructure/preview/preview-token";

import { getAuthServices } from "../../auth/auth-container";
import { requirePageSession } from "../../auth/require-page-session";
import { actorLabel } from "../audit/audit-labels";
import { buildHomeAgenda } from "../home-agenda";
import { getAdminEvents } from "../events/events-admin-read";
import { getAdminNewsItems } from "../news/news-admin-read";
import { PREVIEW_ENDPOINT_PATH } from "./preview-paths";
import { PREVIEW_LIFETIME_OPTIONS, parsePreviewLifetime } from "./preview-lifetimes";

/** What the preview page needs to know before it offers to generate a token. */
export async function getPreviewSetup() {
  await requirePageSession();
  const origin = publicOrigin(process.env.AUTH_URL);

  return { configured: isPreviewConfigured(), endpoint: origin ? `${origin}${PREVIEW_ENDPOINT_PATH}` : null };
}

export interface PreviewCodeView {
  id: string;
  createdAt: Date;
  /** Who generated it, by name. */
  by: string;
  /** Null when the entry does not say how long the code lasts. */
  expiresAt: Date | null;
}

export interface PreviewCodesView {
  scope: "all" | "own";
  codes: PreviewCodeView[];
}

/**
 * The recent codes generated, for the preview page. An Admin reads every generation; an Editor only their own
 * (the use case applies the scope from the session's role, never from anything the request carries).
 * A code is stateless and never stored, so a row has no token: it cannot be shown again or revoked, only expire.
 */
export async function getPreviewCodes(): Promise<PreviewCodesView> {
  const actor = await requirePageSession();
  const services = getAuthServices();
  const rows = await new ListPreviewCodesUseCase(services.audit).execute({ role: actor.role, userId: actor.userId });
  const scope = actor.role === "ADMIN" ? "all" : "own";
  // An Editor's rows are all theirs, so their own name is enough; only an Admin reads the user list.
  const names = new Map<string, string>(scope === "all" ? (await services.listUsers.execute()).map((user) => [user.id, user.name]) : actor.userId ? [[actor.userId, actor.name]] : []);

  return {
    scope,
    codes: rows.map((row) => {
      const lifetime = parsePreviewLifetime(row.lifetimeHint) ?? PREVIEW_LIFETIME_OPTIONS.find((option) => row.summary.includes(`(${option.label})`))?.value;

      return {
        id: row.id,
        createdAt: row.at,
        by: actorLabel(row, names),
        expiresAt: lifetime ? new Date(row.at.getTime() + PREVIEW_TOKEN_TTL_SECONDS[lifetime] * 1000) : null,
      };
    }),
  };
}

/** The drafts and scheduled items a preview code reveals: the same list the admin home shows under "Por atender". */
export async function getPreviewPending(now: Date = new Date()) {
  await requirePageSession();
  const [events, news] = await Promise.all([getAdminEvents().catch(() => []), getAdminNewsItems().catch(() => [])]);
  const { drafts, draftsTotal } = buildHomeAgenda({ events, news, openReports: null, now });

  return { drafts, draftsTotal };
}
