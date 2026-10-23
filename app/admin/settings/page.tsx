import { updateSiteSettings } from "@/interface/admin/settings/actions";
import { getAdminSiteSettings } from "@/interface/admin/settings/settings-admin-read";

import { SettingsForm } from "./_components/settings-form";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getAdminSiteSettings();

  return (
    <section>
      <h1>Sitio</h1>
      <p>Textos generales del sitio público.</p>
      {settings ? null : <p role="status">Todavía no se guardaron estos textos: el sitio usa los suyos hasta el primer guardado.</p>}
      <SettingsForm
        action={updateSiteSettings}
        initialValues={settings ? { tagline: settings.tagline, description: settings.description, about: settings.about } : undefined}
      />
    </section>
  );
}
