import type { SettingsValues } from "@/interface/admin/settings/settings-editor-state";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";

/** What the owner can change in the site texts, in the words of the list of changes. */
export const SETTINGS_PUBLISH_FIELDS: readonly PublishField<SettingsValues>[] = [
  { name: "tagline", label: "Lema" },
  { name: "description", label: "Descripción" },
  { name: "about", label: "Acerca de" },
];

/**
 * Approximate: where each text lands on the public site, in the admin's own type and colours. The tagline
 * only shows in the browser tab title; the description is the hero lead; "Acerca de" is the README block.
 * `changed` holds the names of the texts to highlight.
 */
export function SettingsPreview({ values, changed }: { values: SettingsValues; changed: ReadonlySet<string> }) {
  const tagline = values.tagline.trim();
  const description = values.description.trim();
  const about = values.about.trim();

  return (
    <>
      <SiteSection number="01">Textos del sitio</SiteSection>
      <div className="overflow-hidden rounded">
        <div className="flex items-center gap-2 bg-navy-deep px-3 pt-2">
          <p className="max-w-full truncate rounded-t bg-navy px-3 py-1.5 text-xs">
            ASO Computación
            {tagline ? (
              <>
                {" · "}
                <Changed on={changed.has("tagline")}>{tagline}</Changed>
              </>
            ) : null}
          </p>
        </div>
        <div className="grid gap-4 bg-navy p-5">
          <span className="h-0.5 w-10 bg-sky" />
          {description ? (
            <p className="text-mist wrap-anywhere whitespace-pre-line">
              <Changed on={changed.has("description")}>{description}</Changed>
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 bg-navy-deep p-5">
          <p className="w-fit border border-sky/60 px-2 py-0.5 font-mono text-xs text-sky">README.md</p>
          <p className="font-mono text-xs text-sky">$ cat README.md</p>
          {about ? (
            <p className="text-[0.9375rem] leading-relaxed wrap-anywhere whitespace-pre-line">
              <Changed on={changed.has("about")}>{about}</Changed>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
