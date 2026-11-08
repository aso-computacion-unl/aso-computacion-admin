import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { trashSocialLink, moveSocialLink, setSocialLinkPublished } from "@/interface/admin/socials/actions";
import { socialPlatformLabel } from "@/interface/admin/socials/platform-labels";
import { getAdminSocialLinks } from "@/interface/admin/socials/socials-admin-read";
import { restoreTrashed } from "@/interface/admin/trash/actions";
import { showListTools } from "@/interface/admin/list-params";

import { BulkSelection } from "../_components/bulk-selection";
import { AddRow } from "../_components/list-row";
import { OrderedRow } from "../_components/ordered-row";
import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { ReorderableList } from "../_components/reorderable-list";
import { TrashButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState } from "../_components/empty-state";
import { SectionTitle } from "../_components/section-title";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSocialLinksPage() {
  const links = await getAdminSocialLinks();
  const tools = showListTools(links.length);

  return (
    <div>
      <AreaTabs area="contenido" current="/admin/socials" />
      <PageHeader
        title="Redes sociales"
        status={`main · ${publicationSummary(links)}`}
      />
      {links.length === 0 ? (
        <EmptyState
          icon="share"
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
        <BulkSelection kind="social" enabled={tools} items={links.map((link) => ({ id: link.id, label: link.label }))}>
          <ReorderableList kind="social" items={links.map((link) => ({ id: link.id, label: link.label }))} offset={0} total={links.length} enabled={true} label="Redes sociales, en el orden en que se muestran">
            {links.map((link, index) => (
              <OrderedRow
                key={link.id}
                id={link.id}
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
                remove={<TrashButton label={link.label} warning="¿Mover esta red a la papelera?" action={trashSocialLink.bind(null, link.id)} undo={restoreTrashed.bind(null, "social", link.id)} />}
              >
                <SectionTitle className="leading-tight wrap-anywhere">
                  <Link href={`/admin/socials/${link.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                    {link.label}
                  </Link>
                </SectionTitle>
                <p className="font-mono text-[0.8125rem] wrap-anywhere text-sky">{link.handle}</p>
                {link.label === socialPlatformLabel(link.platform) ? null : <p className="text-sm text-mist">{socialPlatformLabel(link.platform)}</p>}
              </OrderedRow>
            ))}
          </ReorderableList>
          {tools ? null : <AddRow href="/admin/socials/new">Agregar red</AddRow>}
        </BulkSelection>
      )}
    </div>
  );
}
