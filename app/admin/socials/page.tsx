import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { trashSocialLink, moveSocialLink, setSocialLinkPublished } from "@/interface/admin/socials/actions";
import { socialPlatformLabel } from "@/interface/admin/socials/platform-labels";
import { getAdminSocialLinks } from "@/interface/admin/socials/socials-admin-read";

import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSocialLinksPage() {
  const links = await getAdminSocialLinks();

  return (
    <div>
      <PageHead
        title="Redes sociales"
        meta={`main · ${publicationSummary(links)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/socials/new">
              <Icon name="plus" />
              Agregar red
            </Link>
          </Button>
        }
      />
      {links.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/socials/new">
                <Icon name="plus" />
                Agregar la primera red
              </Link>
            </Button>
          }
        >
          Todavía no hay redes. Se muestran en el sitio en el orden de esta lista.
        </EmptyState>
      ) : (
        <OrderedList label="Redes sociales, en el orden en que se muestran">
          {links.map((link, index) => (
            <OrderedRow
              key={link.id}
              published={link.isPublished}
              position={index + 1}
              label={link.label}
              editHref={`/admin/socials/${link.id}/edit`}
              toggle={<PublishedToggle label={link.label} isPublished={link.isPublished} action={setSocialLinkPublished.bind(null, link.id)} />}
              move={
                <MoveButtons
                  label={link.label}
                  isFirst={index === 0}
                  isLast={index === links.length - 1}
                  position={index + 1}
                  total={links.length}
                  action={moveSocialLink.bind(null, link.id)}
                />
              }
              remove={<DeleteButton label={link.label} warning="¿Eliminar esta red?" action={trashSocialLink.bind(null, link.id)} />}
            >
              <h2 className="font-display text-lg leading-tight wrap-anywhere">
                <Link href={`/admin/socials/${link.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </h2>
              <p className="font-mono text-[0.8125rem] wrap-anywhere text-sky">{link.handle}</p>
              {link.label === socialPlatformLabel(link.platform) ? null : <p className="text-sm text-mist">{socialPlatformLabel(link.platform)}</p>}
            </OrderedRow>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
