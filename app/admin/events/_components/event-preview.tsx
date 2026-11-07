import type { EventRegistrationMode } from "@/domain/event-registration";
import type { EventFormValues } from "@/interface/admin/events/event-form-values";
import { formatEventDate } from "@/interface/admin/events/event-timeline";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import { Stamp } from "../../_components/timeline-parts";

const MODE_LABEL: Record<EventRegistrationMode, string> = { none: "Sin inscripción", unl: "Cuenta UNL", open: "Formulario abierto" };

/** "14 nov 2026, 18:00" from the `YYYY-MM-DDTHH:mm` the form keeps (Ecuador time). */
const when = (value: string) => `${formatEventDate(value.slice(0, 10))}, ${value.slice(11, 16)}`;
const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

/** What the owner can change on an event, in the words of the list of changes. */
export const EVENT_PUBLISH_FIELDS: readonly PublishField<EventFormValues>[] = [
  { name: "title", label: "Título" },
  { name: "date", label: "Fecha", format: (values) => formatEventDate(values.date || null, values.datePrecision) },
  { name: "type", label: "Tipo", format: (values) => values.type || "Sin tipo" },
  { name: "description", label: "Descripción" },
  { name: "registrationMode", label: "Inscripción", format: (values) => MODE_LABEL[values.registrationMode] },
  { name: "registrationCapacity", label: "Cupos", format: (values) => values.registrationCapacity || "Sin límite" },
  { name: "registrationDeadline", label: "Cierre", format: (values) => (values.registrationDeadline ? when(values.registrationDeadline) : "Sin cierre") },
  { name: "commitMessage", label: "Mensaje de commit" },
  { name: "hora", label: "Hora" },
  { name: "lugar", label: "Lugar" },
  { name: "para", label: "Para quién" },
  { name: "linkUrl", label: "Enlace" },
  { name: "linkLabel", label: "Texto del enlace" },
  { name: "highlights", label: "Puntos destacados" },
  { name: "featured", label: "Destacado" },
  { name: "publishAt", label: "Publicar el" },
  { name: "unpublishAt", label: "Retirar el" },
  { name: "slug", label: "Identificador" },
];

/** The event as the landing's timeline shows it: its date stamp on the line, the card, and the ticket when people can sign up. */
export function EventPreview({ values, changed, previous }: { values: EventFormValues; changed: ReadonlySet<string>; previous: EventFormValues | null }) {
  const before = new Set(lines(previous?.highlights ?? ""));
  const facts = [
    ["Hora", values.hora, "hora"],
    ["Lugar", values.lugar, "lugar"],
    ["Para quién", values.para, "para"],
  ].filter(([, value]) => value);
  const link = values.linkLabel || values.linkUrl;

  return (
    <>
      <SiteSection number="01">Línea de tiempo</SiteSection>
      <div className="border-l-[3px] border-sky pl-6">
        <Stamp solid className="-ml-7 mb-3">
          <Changed on={changed.has("date")}>{formatEventDate(values.date || null, values.datePrecision)}</Changed>
        </Stamp>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 content-start gap-3">
            {values.commitMessage ? (
              <p className="font-mono text-sm font-semibold wrap-anywhere text-mist">
                $ <Changed on={changed.has("commitMessage")}>{values.commitMessage}</Changed>
              </p>
            ) : null}
            <h3 className="font-display text-3xl leading-tight wrap-anywhere text-foreground">
              <Changed on={changed.has("title")}>{values.title}</Changed>
            </h3>
            {values.type ? (
              <p>
                <span className="inline-block rounded-sm bg-tint-blue px-2 py-1.5 font-mono text-[0.6875rem] leading-none font-semibold tracking-wider text-on-tint-blue uppercase">
                  <Changed on={changed.has("type")}>{values.type}</Changed>
                </span>
              </p>
            ) : null}
            {values.description ? (
              <p className="max-w-prose text-mist">
                <Changed on={changed.has("description")}>{values.description}</Changed>
              </p>
            ) : null}
            <ul className="grid gap-1 font-semibold">
              {lines(values.highlights).map((line) => (
                <li key={line} className="flex gap-2 before:text-signal before:content-['▸']">
                  <span>
                    <Changed on={changed.has("highlights") && !before.has(line)}>{line}</Changed>
                  </span>
                </li>
              ))}
            </ul>
            {facts.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                {facts.map(([label, value, name]) => (
                  <div key={name} className="contents">
                    <dt className="font-semibold text-sky">{label}</dt>
                    <dd>
                      <Changed on={changed.has(name!)}>{value}</Changed>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {link ? (
              <p className="font-semibold text-sky underline decoration-2 underline-offset-4">
                <Changed on={changed.has("linkUrl") || changed.has("linkLabel")}>{link}</Changed>
              </p>
            ) : null}
          </div>
          {values.registrationMode === "none" ? null : (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] self-start border-t-[9px] border-sky bg-tint-blue shadow-[0_3px_0_var(--color-dash)]">
              <div className="grid min-w-0 gap-1.5 p-3.5">
                <span className="justify-self-start bg-sky px-2 py-1 font-mono text-[0.6875rem] leading-none font-semibold text-navy">
                  <Changed on={changed.has("registrationMode")}>{MODE_LABEL[values.registrationMode]}</Changed>
                </span>
                <span className="text-lg leading-tight font-black wrap-anywhere text-on-tint-blue">{values.title}</span>
                <span className="font-mono text-xs text-on-tint-blue">
                  <Changed on={changed.has("registrationDeadline")}>{values.registrationDeadline ? `Inscripciones hasta ${when(values.registrationDeadline)}` : "Sin fecha de cierre"}</Changed>
                </span>
              </div>
              <div className="grid min-w-26 place-items-center border-l-2 border-dashed border-dash bg-sky p-3 text-center text-navy">
                <span className="font-mono text-[0.625rem] leading-tight font-semibold tracking-wide uppercase">
                  {values.registrationCapacity ? (
                    <>
                      <strong className="block font-sans text-3xl leading-none font-black tracking-tight normal-case">
                        <Changed on={changed.has("registrationCapacity")}>{values.registrationCapacity}</Changed>
                      </strong>
                      cupos
                    </>
                  ) : (
                    <Changed on={changed.has("registrationCapacity")}>Sin límite de cupos</Changed>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
