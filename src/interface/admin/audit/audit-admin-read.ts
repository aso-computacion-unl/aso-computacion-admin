import "server-only";

import { getAuthServices } from "../../auth/auth-container";
import { requirePageSession } from "../../auth/require-page-session";
import { parseAuditParams } from "./audit-labels";

/** One page of the audit log, newest first, with the people that can be filtered on. ADMIN only. */
export async function getAuditLogPage(params: Parameters<typeof parseAuditParams>[0]) {
  await requirePageSession("ADMIN");

  const { page, entityType, actor } = parseAuditParams(params);
  const services = getAuthServices();
  const [log, users] = await Promise.all([services.listAuditLog.execute({ page, entityType, actor }), services.listUsers.execute()]);

  return { ...log, filters: { entityType, actor }, users: users.map((user) => ({ id: user.id, name: user.name })) };
}
