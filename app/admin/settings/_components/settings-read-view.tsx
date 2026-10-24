import type { SettingsValues } from "@/interface/admin/settings/settings-editor-state";

const ROWS: { field: keyof SettingsValues; label: string; where: string }[] = [
  { field: "tagline", label: "Lema", where: "Título de la pestaña" },
  { field: "description", label: "Descripción", where: "Portada y buscadores" },
  { field: "about", label: "Acerca de", where: "Sección Nosotros" },
];

/**
 * The saved texts as content, not as fields: nothing here looks editable. Each text is its own zone,
 * label and where it shows on the left, the text across the remaining width on the right.
 */
export function SettingsReadView({ values }: { values: SettingsValues }) {
  return (
    <dl className="divide-y divide-border border-y border-border">
      {ROWS.map(({ field, label, where }) => (
        <div key={field} className="grid min-w-0 gap-1.5 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
          <dt className="grid content-start gap-0.5">
            <span className="text-sm leading-[1.3] font-[650]">{label}</span>
            <span className="font-mono text-xs text-mist">{where}</span>
          </dt>
          <dd className="wrap-anywhere whitespace-pre-line text-pretty">
            {values[field].trim() ? values[field] : <span className="text-mist">Sin completar</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
