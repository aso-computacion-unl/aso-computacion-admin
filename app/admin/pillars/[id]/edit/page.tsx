import Link from "next/link";
import { notFound } from "next/navigation";

import { updatePillar } from "@/interface/admin/pillars/actions";
import { getAdminPillar } from "@/interface/admin/pillars/pillars-admin-read";

import { PillarForm } from "../../_components/pillar-form";
import { PillarImagePanel } from "../../_components/pillar-image-panel";

export const dynamic = "force-dynamic";

interface EditPillarPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPillarPage({ params }: EditPillarPageProps) {
  const { id } = await params;
  const pillar = await getAdminPillar(id);

  if (!pillar) notFound();

  return (
    <section>
      <p>
        <Link href="/admin/pillars">← Volver a pilares</Link>
      </p>
      <h1>Editar pilar</h1>
      {/* Keyed by the image so the alt field and the panel start fresh after a replace or remove. */}
      <PillarForm
        key={pillar.image?.url ?? "no-image"}
        action={updatePillar.bind(null, id)}
        submitLabel="Guardar cambios"
        hasImage={pillar.image !== null}
        initialValues={{
          word: pillar.word,
          title: pillar.title,
          text: pillar.text,
          imageAlt: pillar.image?.alt ?? "",
          isPublished: pillar.isPublished,
        }}
      />
      <PillarImagePanel key={pillar.image?.url ?? "no-image"} pillarId={id} image={pillar.image} />
    </section>
  );
}
