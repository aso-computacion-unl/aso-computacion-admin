/** Which stored collection holds a command name. */
export type CommandNameOwner = "faq" | "command";

/**
 * Read-only view over every stored command name (FAQ commands and free
 * commands, published or not). The names are unique across both collections,
 * which no single repository can see, so use cases ask this port.
 */
export interface CommandNameRegistry {
  /** Who already uses the name, ignoring the row `except` (the one being edited), or null when it is free. */
  findOwner(command: string, except?: { kind: CommandNameOwner; id: string }): Promise<CommandNameOwner | null>;
}
