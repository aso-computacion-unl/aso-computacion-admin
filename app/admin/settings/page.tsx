import { updateSiteSettings } from "@/interface/admin/settings/actions";
import { getAdminSiteSettings } from "@/interface/admin/settings/settings-admin-read";

import { PageHead, Panel } from "../_components/page-head";
import { SettingsForm } from "./_components/settings-form";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getAdminSiteSettings();

  return (
    <div className="max-w-4xl">
      <PageHead title="Sitio" meta="Textos generales del sitio público." />
      <div className="mt-6 grid gap-6">
        {settings ? null : (
          <p role="status" className="border-l-2 border-dashed border-sky pl-4 text-mist">
            Todavía no se guardaron estos textos: el sitio usa los suyos hasta el primer guardado.
          </p>
        )}
        <Panel>
          <SettingsForm
            action={updateSiteSettings}
            initialValues={settings ? { tagline: settings.tagline, description: settings.description, about: settings.about } : undefined}
          />
        </Panel>
      </div>
    </div>
  );
}
