import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { BoardMemberFormValues } from "./board-member-form";

/** What the owner can change on a board member, in the words of the list of changes. */
export const BOARD_MEMBER_PUBLISH_FIELDS: readonly PublishField<BoardMemberFormValues>[] = [
  { name: "name", label: "Nombre" },
  { name: "role", label: "Cargo" },
  { name: "photoAlt", label: "Descripción de la foto" },
];

interface BoardMemberPreviewProps {
  values: BoardMemberFormValues;
  /** The stored photo, when the member has one; its alt is the one in the form. */
  photo: { url: string } | null;
  /** The names of the fields to highlight. */
  changed: ReadonlySet<string>;
}

/** Approximate: the member's card in the admin's own type. The site applies its own design. */
export function BoardMemberPreview({ values, photo, changed }: BoardMemberPreviewProps) {
  return (
    <>
      <SiteSection number="01">Directiva</SiteSection>
      <figure className="grid w-fit max-w-60 gap-3 rounded border border-paper-ring p-4">
        {photo ? (
          // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl(photo.url, 240, 240)} alt={values.photoAlt} loading="lazy" decoding="async" width={240} height={240} className="aspect-square w-full rounded-xs object-cover" />
        ) : null}
        <figcaption className="grid gap-1">
          {values.name.trim() ? (
            <span className="font-display text-xl leading-tight wrap-anywhere text-foreground">
              <Changed on={changed.has("name")}>{values.name}</Changed>
            </span>
          ) : null}
          {values.role.trim() ? (
            <span className="font-mono text-xs font-semibold text-sky wrap-anywhere">
              <Changed on={changed.has("role")}>{values.role}</Changed>
            </span>
          ) : null}
        </figcaption>
      </figure>
    </>
  );
}
