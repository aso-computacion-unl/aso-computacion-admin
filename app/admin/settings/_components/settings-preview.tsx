import type { SettingsValues } from "@/interface/admin/settings/settings-editor-state";

import { Panel } from "../../_components/page-head";

/**
 * Approximate: the landing's hero and "Nosotros" block in the admin's own type and colours.
 * The visible mock is hidden from screen readers, who already have the same text in the fields.
 */
export function SettingsPreview({ values }: { values: SettingsValues }) {
  const tagline = values.tagline.trim();
  const description = values.description.trim();
  const about = values.about.trim();
  const empty = !tagline && !description && !about;

  return (
    <Panel aria-label="Vista previa" className="grid gap-4 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold font-stretch-[112%]">Vista previa</h2>
        <p className="font-mono text-[0.8125rem] text-mist">se actualiza al escribir</p>
      </div>
      {empty ? (
        <p role="status" className="text-mist">
          Escriba el lema, la descripción o el texto «Acerca de» para ver cómo se lee en el sitio.
        </p>
      ) : (
        <div aria-hidden="true" className="overflow-hidden rounded">
          <div className="grid gap-4 bg-navy p-5">
            <span className="h-0.5 w-10 bg-sky" />
            {tagline ? <p className="font-display text-2xl leading-tight wrap-anywhere">{tagline}</p> : null}
            {description ? <p className="text-mist wrap-anywhere whitespace-pre-line">{description}</p> : null}
          </div>
          <div className="grid gap-3 bg-navy-deep p-5">
            <p className="w-fit border border-sky/60 px-2 py-0.5 font-mono text-xs text-sky">README.md</p>
            <p className="font-mono text-xs text-sky">$ cat README.md</p>
            {about ? <p className="text-[0.9375rem] leading-relaxed wrap-anywhere whitespace-pre-line">{about}</p> : null}
          </div>
        </div>
      )}
    </Panel>
  );
}
