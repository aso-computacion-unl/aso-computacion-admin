import { optionalCommandName } from "./command-name";
import { assertSortOrder } from "./sort-order";
import { requiredText } from "./text";

export const FAQ_QUESTION_MAX_LENGTH = 200;
export const FAQ_ANSWER_MAX_LENGTH = 1000;

export interface FaqProps {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  /** Optional `git help <command>` topic on the landing; null keeps the auto-generated one. */
  readonly command: string | null;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FaqFields {
  question: string;
  answer: string;
  command: string | null;
  sortOrder: number;
  isPublished: boolean;
}

/** `command` may be blank or null: both mean "no command". */
export type CreateFaqInput = Pick<FaqFields, "question" | "answer" | "sortOrder"> & Partial<Pick<FaqFields, "command" | "isPublished">>;
/** `command`: undefined keeps it, blank or null clears it. */
export type UpdateFaqInput = Partial<Pick<FaqFields, "question" | "answer" | "command" | "isPublished">>;

function build(base: Pick<FaqProps, "id" | "createdAt" | "updatedAt">, fields: FaqFields): FaqProps {
  return {
    ...base,
    question: requiredText("question", fields.question, FAQ_QUESTION_MAX_LENGTH),
    answer: requiredText("answer", fields.answer, FAQ_ANSWER_MAX_LENGTH),
    command: optionalCommandName("command", fields.command),
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class Faq {
  private constructor(readonly props: FaqProps) {}

  static create(input: CreateFaqInput): Faq {
    const now = new Date();

    return new Faq(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { command: null, isPublished: false, ...input }));
  }

  /** Rehydrates a FAQ from trusted persistence data without validation. */
  static reconstitute(props: FaqProps): Faq {
    return new Faq(props);
  }

  private with(changes: Partial<FaqFields>): Faq {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new Faq(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update(updates: UpdateFaqInput): Faq {
    return this.with(updates);
  }

  withPublished(isPublished: boolean): Faq {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): Faq {
    return this.with({ sortOrder });
  }
}
