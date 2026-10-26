import type { AuditEntry, AuditLogReader } from "../ports/auth.ports";

export const AUDIT_PAGE_SIZE = 25;

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageCount: number;
  entityTypes: string[];
}

const pageCountOf = (total: number) => Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

/** The page to show: the requested one, kept within 1..last (the first when the request is not a page number). */
export function clampPage(page: number, total: number): number {
  return Number.isInteger(page) && page >= 1 ? Math.min(page, pageCountOf(total)) : 1;
}

export class ListAuditLogUseCase {
  constructor(private readonly reader: AuditLogReader) {}

  async execute(input: { page: number; entityType?: string; actor?: string }): Promise<AuditPage> {
    const { entityType, actor } = input;
    const requested = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
    const [first, entityTypes] = await Promise.all([this.reader.list({ entityType, actor, page: requested, pageSize: AUDIT_PAGE_SIZE }), this.reader.entityTypes()]);
    const page = clampPage(requested, first.total);
    // A page past the end (a stale link, an edited URL) shows the last page, not an empty one.
    const { items, total } = page === requested ? first : await this.reader.list({ entityType, actor, page, pageSize: AUDIT_PAGE_SIZE });

    return { items, total, page, pageCount: pageCountOf(total), entityTypes };
  }
}
