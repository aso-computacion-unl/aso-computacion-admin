import { notFound } from "next/navigation";

import { updateNewsItem } from "@/interface/admin/news/actions";
import { getAdminNewsItem } from "@/interface/admin/news/news-admin-read";

import { FormFrame } from "../../../_components/page-head";
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
    <FormFrame backHref="/admin/news" backLabel="Volver a novedades" title="Editar noticia" meta={`${item.slug} · ${item.isPublished ? "publicada" : "borrador"}`}>
      {/* Keyed by the cover so the alt field and the panel start fresh after a replace or remove. */}
      <NewsForm
        key={item.cover?.url ?? "no-cover"}
        action={updateNewsItem.bind(null, id)}
        submitLabel="Guardar cambios"
        isEditing
        cover={item.cover}
        asideTop={<NewsCoverPanel newsId={id} cover={item.cover} />}
        initialValues={{
          title: item.title,
          slug: item.slug,
          summary: item.summary,
          body: item.body,
          publishedAt: item.publishedAt,
          coverAlt: item.cover?.alt ?? "",
          isPublished: item.isPublished,
        }}
      />
    </FormFrame>
  );
}
