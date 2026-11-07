import { notFound } from "next/navigation";

import { updateNewsItem } from "@/interface/admin/news/actions";
import { getAdminNewsItem } from "@/interface/admin/news/news-admin-read";
import { windowEndToFormValue } from "@/interface/admin/publication-window-fields";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { NewsCoverPanel } from "../../_components/news-cover-panel";
import { NewsForm } from "../../_components/news-form";

export const dynamic = "force-dynamic";

interface EditNewsPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditNewsPage({ params }: EditNewsPageProps) {
  const { id } = await params;
  const item = await getAdminNewsItem(id);

  if (!item) notFound();

  return (
    <FormLayout backHref="/admin/news" backLabel="Volver a novedades" title={item.title} status={recordStatus(item.isPublished, "f", item.slug)}>
      <Panel aria-label="Datos de la noticia">
        {/* Keyed by the cover so the alt field starts fresh after a replace or remove. */}
        <NewsForm
          key={item.cover?.url ?? "no-cover"}
          action={updateNewsItem.bind(null, id)}
          submitLabel="Guardar cambios"
          isEditing
          cover={item.cover}
          initialValues={{
            title: item.title,
            slug: item.slug,
            summary: item.summary,
            body: item.body,
            publishedAt: item.publishedAt,
            coverAlt: item.cover?.alt ?? "",
            isPublished: item.isPublished,
            publishAt: windowEndToFormValue(item.publishAt),
            unpublishAt: windowEndToFormValue(item.unpublishAt),
          }}
        />
      </Panel>
      <NewsCoverPanel newsId={id} cover={item.cover} />
    </FormLayout>
  );
}
