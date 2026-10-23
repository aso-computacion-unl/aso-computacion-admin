import type { SettingsValues } from "@/interface/admin/settings/settings-editor-state";

const ROWS: { field: keyof SettingsValues; label: string }[] = [
  { field: "tagline", label: "Lema" },
  { field: "description", label: "Descripción" },
  { field: "about", label: "Acerca de" },
];

/** The saved texts as content, not as fields: nothing here looks editable. */
export function SettingsReadView({ values }: { values: SettingsValues }) {
  return (
    <dl className="grid gap-5">
      {ROWS.map(({ field, label }) => (
        <div key={field} className="grid min-w-0 gap-1.5">
          <dt className="text-sm leading-[1.3] font-[650] text-mist">{label}</dt>
          <dd className="max-w-[68ch] wrap-anywhere whitespace-pre-line">
            {values[field].trim() ? values[field] : <span className="text-mist">Sin completar</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
