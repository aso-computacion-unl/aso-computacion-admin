import { notFound } from "next/navigation";

import { updateSocialLink } from "@/interface/admin/socials/actions";
import { getAdminSocialLink } from "@/interface/admin/socials/socials-admin-read";

import { FormPage, Panel } from "../../../_components/page-head";
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
    <FormPage backHref="/admin/socials" backLabel="Volver a redes" title="Editar red">
      <Panel>
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
      </Panel>
    </FormPage>
  );
}
