import type { AuditEntry, AuditLogReader } from "../ports/auth.ports";

export const AUDIT_PAGE_SIZE = 25;

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageCount: number;
  entityTypes: string[];
}

export class ListAuditLogUseCase {
  constructor(private readonly reader: AuditLogReader) {}

  async execute(input: { page: number; entityType?: string; actor?: string }): Promise<AuditPage> {
    const page = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
    const [{ items, total }, entityTypes] = await Promise.all([
      this.reader.list({ entityType: input.entityType, actor: input.actor, page, pageSize: AUDIT_PAGE_SIZE }),
      this.reader.entityTypes(),
    ]);

    return { items, total, page, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), entityTypes };
  }
}
