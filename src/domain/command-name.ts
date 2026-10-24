import { ValidationError } from "./domain-error";

export const COMMAND_NAME_MIN_LENGTH = 2;
/** The landing's current auto-topic limit (`TOPIC_MAX`). */
export const COMMAND_NAME_MAX_LENGTH = 28;

/** The shell's own words (`HELP_WORDS` and `clear`): no FAQ topic or free command may shadow them. */
export const RESERVED_COMMAND_NAMES: readonly string[] = ["help", "ayuda", "ls", "clear", "git"];

const COMMAND_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export type CommandNameConflict = "reserved" | "faq" | "command";

/**
 * A well-formed command name that is still taken: a shell word, another FAQ's
 * command or a free command. Carries who owns it so the interface can name it.
 */
export class CommandNameConflictError extends ValidationError {
  constructor(
    field: string,
    public readonly command: string,
    public readonly conflict: CommandNameConflict,
  ) {
    super(field, `${field} "${command}" is already taken (${conflict})`);
    this.name = "CommandNameConflictError";
  }
}

/**
 * Trims and checks the shared command-name rule (FAQ commands and free
 * commands alike): lowercase letters, digits and single hyphens, starting with
 * a letter, 2 to 28 characters, and never a reserved shell word. Uniqueness
 * across the stored commands is an application concern.
 */
export function assertCommandName(field: string, value: string): string {
  const name = value.trim();

  if (
    name.length < COMMAND_NAME_MIN_LENGTH ||
    name.length > COMMAND_NAME_MAX_LENGTH ||
    !COMMAND_NAME_PATTERN.test(name)
  ) {
    throw new ValidationError(
      field,
      `${field} must be ${COMMAND_NAME_MIN_LENGTH}-${COMMAND_NAME_MAX_LENGTH} lowercase letters, digits and single hyphens, starting with a letter`,
    );
  }

  if (RESERVED_COMMAND_NAMES.includes(name)) {
    throw new CommandNameConflictError(field, name, "reserved");
  }

  return name;
}

/** Blank or missing becomes null; anything else must satisfy `assertCommandName`. */
export function optionalCommandName(field: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }

  return assertCommandName(field, value);
}
