import Link from "next/link";

import { createSocialLink } from "@/interface/admin/socials/actions";

import { SocialForm } from "../_components/social-form";

export default function NewSocialLinkPage() {
  return (
    <section>
      <p>
        <Link href="/admin/socials">← Volver a redes</Link>
      </p>
      <h1>Agregar red</h1>
      <p>Se agrega al final de la lista; luego puede moverla.</p>
      <SocialForm action={createSocialLink} submitLabel="Agregar red" />
    </section>
  );
}
