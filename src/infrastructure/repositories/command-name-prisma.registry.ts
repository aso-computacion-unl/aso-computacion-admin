import "server-only";

import type { CommandNameOwner, CommandNameRegistry } from "@/application/ports/command-name-registry.port";

import { prisma } from "../prisma/client";
import { LIVE } from "./publication-filter";

/** Looks a command name up in every table that holds one; a trashed row frees its name. */
export class CommandNamePrismaRegistry implements CommandNameRegistry {
  async findOwner(command: string, except?: { kind: CommandNameOwner; id: string }): Promise<CommandNameOwner | null> {
    const notExcepted = (kind: CommandNameOwner) => (except?.kind === kind ? { id: { not: except.id } } : {});

    const [faq, free] = await Promise.all([
      prisma.faq.findFirst({ where: { command, ...LIVE, ...notExcepted("faq") }, select: { id: true } }),
      prisma.terminalCommand.findFirst({ where: { command, ...LIVE, ...notExcepted("command") }, select: { id: true } }),
    ]);

    return faq ? "faq" : free ? "command" : null;
  }
}
