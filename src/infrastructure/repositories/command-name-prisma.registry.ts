import "server-only";

import type { CommandNameOwner, CommandNameRegistry } from "@/application/ports/command-name-registry.port";

import { prisma } from "../prisma/client";

/** Looks a command name up in every table that holds one. */
export class CommandNamePrismaRegistry implements CommandNameRegistry {
  async findOwner(command: string, except?: { kind: CommandNameOwner; id: string }): Promise<CommandNameOwner | null> {
    const faq = await prisma.faq.findFirst({
      where: { command, ...(except?.kind === "faq" ? { id: { not: except.id } } : {}) },
      select: { id: true },
    });

    return faq ? "faq" : null;
  }
}
