import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { CommandFormValues } from "./command-form";

/** What the owner can change on a command, in the words of the list of changes. */
export const COMMAND_PUBLISH_FIELDS: readonly PublishField<CommandFormValues>[] = [
  { name: "command", label: "Comando" },
  { name: "description", label: "Descripción" },
  { name: "output", label: "Respuesta" },
];

interface CommandPreviewProps {
  values: CommandFormValues;
  /** The names of the fields to highlight. */
  changed: ReadonlySet<string>;
}

/** Approximate: the command as the site's terminal prints it and lists it in its help. The site applies its own design. */
export function CommandPreview({ values, changed }: CommandPreviewProps) {
  const command = values.command.trim();
  const description = values.description.trim();

  return (
    <>
      <SiteSection number="01">Terminal</SiteSection>
      <div className="grid max-w-2xl gap-1 rounded bg-muted p-4 font-mono text-sm">
        <p className="text-sky">
          ❯ <Changed on={changed.has("command")}>{command || "…"}</Changed>
        </p>
        {values.output.trim() ? (
          <p className="wrap-anywhere whitespace-pre-wrap">
            <Changed on={changed.has("output")}>{values.output}</Changed>
          </p>
        ) : null}
      </div>
      {command && description ? (
        <p className="mt-3 font-mono text-[0.8125rem] text-mist wrap-anywhere">
          En la ayuda: {command} — <Changed on={changed.has("description")}>{description}</Changed>
        </p>
      ) : null}
    </>
  );
}
