import { assertCommandName } from "./command-name";
import { assertSortOrder } from "./sort-order";
import { requiredText } from "./text";

export const TERMINAL_COMMAND_DESCRIPTION_MAX_LENGTH = 80;
export const TERMINAL_COMMAND_OUTPUT_MAX_LENGTH = 600;

export interface TerminalCommandProps {
  readonly id: string;
  /** The word typed in the landing's terminal; unique across FAQ commands and free commands. */
  readonly command: string;
  /** One line shown next to the command in `help`. */
  readonly description: string;
  /** What the terminal prints; may span several lines. */
  readonly output: string;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TerminalCommandFields {
  command: string;
  description: string;
  output: string;
  sortOrder: number;
  isPublished: boolean;
}

export type CreateTerminalCommandInput = Pick<TerminalCommandFields, "command" | "description" | "output" | "sortOrder"> &
  Partial<Pick<TerminalCommandFields, "isPublished">>;
export type UpdateTerminalCommandInput = Partial<Pick<TerminalCommandFields, "command" | "description" | "output" | "isPublished">>;

function build(base: Pick<TerminalCommandProps, "id" | "createdAt" | "updatedAt">, fields: TerminalCommandFields): TerminalCommandProps {
  return {
    ...base,
    command: assertCommandName("command", fields.command),
    description: requiredText("description", fields.description, TERMINAL_COMMAND_DESCRIPTION_MAX_LENGTH),
    output: requiredText("output", fields.output, TERMINAL_COMMAND_OUTPUT_MAX_LENGTH),
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class TerminalCommand {
  private constructor(readonly props: TerminalCommandProps) {}

  static create(input: CreateTerminalCommandInput): TerminalCommand {
    const now = new Date();

    return new TerminalCommand(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { isPublished: false, ...input }));
  }

  /** Rehydrates a command from trusted persistence data without validation. */
  static reconstitute(props: TerminalCommandProps): TerminalCommand {
    return new TerminalCommand(props);
  }

  private with(changes: Partial<TerminalCommandFields>): TerminalCommand {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new TerminalCommand(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update(updates: UpdateTerminalCommandInput): TerminalCommand {
    return this.with(updates);
  }

  withPublished(isPublished: boolean): TerminalCommand {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): TerminalCommand {
    return this.with({ sortOrder });
  }
}
