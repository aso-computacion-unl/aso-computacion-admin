import "server-only";

import type { CommandNameOwner, CommandNameRegistry } from "@/application/ports/command-name-registry.port";

import { prisma } from "../prisma/client";

/** Looks a command name up in every table that holds one. */
export class CommandNamePrismaRegistry implements CommandNameRegistry {
  async findOwner(command: string, except?: { kind: CommandNameOwner; id: string }): Promise<CommandNameOwner | null> {
    const notExcepted = (kind: CommandNameOwner) => (except?.kind === kind ? { id: { not: except.id } } : {});

    const [faq, free] = await Promise.all([
      prisma.faq.findFirst({ where: { command, ...notExcepted("faq") }, select: { id: true } }),
      prisma.terminalCommand.findFirst({ where: { command, ...notExcepted("command") }, select: { id: true } }),
    ]);

    return faq ? "faq" : free ? "command" : null;
  }
}
