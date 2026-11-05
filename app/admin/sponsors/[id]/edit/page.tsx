import { notFound } from "next/navigation";

import { updateSponsor } from "@/interface/admin/sponsors/actions";
import { getAdminSponsor } from "@/interface/admin/sponsors/sponsors-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { SponsorForm } from "../../_components/sponsor-form";
import { SponsorLogoPanel } from "../../_components/sponsor-logo-panel";

export const dynamic = "force-dynamic";

interface EditSponsorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSponsorPage({ params }: EditSponsorPageProps) {
  const { id } = await params;
  const sponsor = await getAdminSponsor(id);

  if (!sponsor) notFound();

  return (
    <FormLayout
      backHref="/admin/sponsors"
      backLabel="Volver a los aliados"
      title={sponsor.name}
      status={recordStatus(sponsor.isPublished, "m")}
      aside={<SponsorLogoPanel key={sponsor.logo?.url ?? "no-logo"} sponsorId={id} logo={sponsor.logo} />}
    >
      {/* Keyed by the logo so the alt field and the panel start fresh after a replace or remove. */}
      <Panel>
        <SponsorForm
          key={sponsor.logo?.url ?? "no-logo"}
          action={updateSponsor.bind(null, id)}
          submitLabel="Guardar cambios"
          hasLogo={sponsor.logo !== null}
          initialValues={{ name: sponsor.name, url: sponsor.url ?? "", logoAlt: sponsor.logo?.alt ?? "", isPublished: sponsor.isPublished }}
        />
      </Panel>
    </FormLayout>
  );
}
