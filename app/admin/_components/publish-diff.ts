/** A form field the publish preview compares: `format` turns its value into the words the list of changes prints. */
export interface PublishField<V> {
  name: keyof V & string;
  label: string;
  format?: (values: V) => string;
}

export interface FieldChange {
  name: string;
  label: string;
  before: string;
  after: string;
}

const CLIP_AT = 60;

/** How a value reads in the list of changes: Sí / No for a switch, "Vacío" for nothing, one clipped line for text. */
export function describeValue(value: string | boolean): string {
  if (typeof value === "boolean") return value ? "Sí" : "No";

  const text = value.trim().replace(/\s+/g, " ");

  if (text === "") return "Vacío";

  return text.length > CLIP_AT ? `${text.slice(0, CLIP_AT - 1)}…` : text;
}

/** The fields whose value differs between the stored row and the form, in the order of `fields`. */
export function diffFields<V extends { [K in keyof V]: string | boolean }>(before: V, after: V, fields: readonly PublishField<V>[]): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const { name, label, format } of fields) {
    if (before[name] === after[name]) continue;

    const read = (values: V) => (format ? describeValue(format(values)) : describeValue(values[name]));
    const change = { name, label, before: read(before), after: read(after) };

    // A difference the list cannot show (extra spaces) is not a change to confirm.
    if (change.before !== change.after) changes.push(change);
  }

  return changes;
}

export const changeText = ({ label, before, after }: FieldChange) => `${label}: ${before} → ${after}`;
