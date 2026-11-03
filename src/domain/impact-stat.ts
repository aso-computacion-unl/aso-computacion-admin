import { assertSortOrder } from "./sort-order";
import { requiredText } from "./text";

export const IMPACT_STAT_VALUE_MAX_LENGTH = 20;
export const IMPACT_STAT_LABEL_MAX_LENGTH = 60;

/** A number the landing shows big ("120+") and what it counts ("Estudiantes en la comunidad"). */
export interface ImpactStatProps {
  readonly id: string;
  /** Free text, not a number: "120+", "3 años", "12 / año". */
  readonly value: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ImpactStatFields {
  value: string;
  label: string;
  sortOrder: number;
  isPublished: boolean;
}

export type CreateImpactStatInput = Pick<ImpactStatFields, "value" | "label" | "sortOrder"> & Partial<Pick<ImpactStatFields, "isPublished">>;
export type UpdateImpactStatInput = Partial<Pick<ImpactStatFields, "value" | "label" | "isPublished">>;

function build(base: Pick<ImpactStatProps, "id" | "createdAt" | "updatedAt">, fields: ImpactStatFields): ImpactStatProps {
  return {
    ...base,
    value: requiredText("value", fields.value, IMPACT_STAT_VALUE_MAX_LENGTH),
    label: requiredText("label", fields.label, IMPACT_STAT_LABEL_MAX_LENGTH),
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class ImpactStat {
  private constructor(readonly props: ImpactStatProps) {}

  static create(input: CreateImpactStatInput): ImpactStat {
    const now = new Date();

    return new ImpactStat(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { ...input, isPublished: input.isPublished ?? false }));
  }

  /** Rehydrates a stat from trusted persistence data without validation. */
  static reconstitute(props: ImpactStatProps): ImpactStat {
    return new ImpactStat(props);
  }

  private with(changes: Partial<ImpactStatFields>): ImpactStat {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new ImpactStat(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update(updates: UpdateImpactStatInput): ImpactStat {
    return this.with(updates);
  }

  withPublished(isPublished: boolean): ImpactStat {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): ImpactStat {
    return this.with({ sortOrder });
  }
}
