import Link from "next/link";
import { notFound } from "next/navigation";

import { updateSocialLink } from "@/interface/admin/socials/actions";
import { getAdminSocialLink } from "@/interface/admin/socials/socials-admin-read";

import { SocialForm } from "../../_components/social-form";

export const dynamic = "force-dynamic";

interface EditSocialLinkPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSocialLinkPage({ params }: EditSocialLinkPageProps) {
  const { id } = await params;
  const link = await getAdminSocialLink(id);

  if (!link) notFound();

  return (
    <section>
      <p>
        <Link href="/admin/socials">← Volver a redes</Link>
      </p>
      <h1>Editar red</h1>
      <SocialForm
        action={updateSocialLink.bind(null, id)}
        submitLabel="Guardar cambios"
        initialValues={{
          platform: link.platform,
          label: link.label,
          handle: link.handle,
          url: link.url,
          note: link.note ?? "",
          blurb: link.blurb ?? "",
          isPublished: link.isPublished,
        }}
      />
    </section>
  );
}
