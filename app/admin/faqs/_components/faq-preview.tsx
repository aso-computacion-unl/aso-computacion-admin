import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { FaqFormValues } from "./faq-form";

/** What the owner can change on a question, in the words of the list of changes. */
export const FAQ_PUBLISH_FIELDS: readonly PublishField<FaqFormValues>[] = [
  { name: "question", label: "Pregunta" },
  { name: "answer", label: "Respuesta" },
  { name: "command", label: "Comando", format: (values) => values.command.trim() || "Sin comando" },
];

/** The question as the landing's FAQ shows it: the question, its answer and the `git help` line when it has a command. */
export function FaqPreview({ values, changed }: { values: FaqFormValues; changed: ReadonlySet<string> }) {
  const command = values.command.trim();

  return (
    <>
      <SiteSection number="01">Preguntas frecuentes</SiteSection>
      <article className="grid gap-3 rounded border border-paper-ring p-5">
        <h3 className="font-display text-2xl leading-tight wrap-anywhere text-foreground">
          <Changed on={changed.has("question")}>{values.question}</Changed>
        </h3>
        <p className="max-w-prose whitespace-pre-line text-mist">
          <Changed on={changed.has("answer")}>{values.answer}</Changed>
        </p>
        {command ? (
          <p className="font-mono text-sm text-sky">
            <Changed on={changed.has("command")}>❯ git help {command}</Changed>
          </p>
        ) : null}
      </article>
    </>
  );
}
