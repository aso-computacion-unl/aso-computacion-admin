import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/interface/admin/role-labels";
import { getInvitationForLink } from "@/interface/auth/invitation-read";

import { BrandLogo } from "../../_components/brand-mark";
import { ThemeToggle } from "../../_components/theme-toggle";

export const metadata: Metadata = {
  title: "Invitación — ASO Computación",
  description: "Invitación al panel de administración de ASO Computación.",
  robots: { index: false, follow: false },
};

// Whether the link still works changes with time and with the admin's actions.
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationForLink(token);

  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <ThemeToggle className="absolute top-3 right-3" />
      <div className="w-full max-w-sm">
        <BrandLogo alt="ASO Computación" width={168} className="mb-10 h-auto w-42" />

        {/* Same branch line as the login page. */}
        <section aria-labelledby="invitation-title" className="relative border-l-2 border-sky pb-2 pl-7">
          <span
            aria-hidden="true"
            className="absolute top-[0.8125rem] -left-[calc(0.5625rem+1px)] size-[1.125rem] rounded-full border-[3px] border-navy bg-sky"
          />
          <h1 id="invitation-title" className="font-display text-[1.75rem] leading-[1.15]">
            {invitation ? "Lo invitaron al panel" : "Invitación no disponible"}
          </h1>
          {invitation ? (
            <>
              <p className="mt-2 mb-6 text-mist">
                Entre con la cuenta de Google de <strong className="font-mono text-[0.9375rem] font-semibold wrap-anywhere text-foreground">{invitation.email}</strong> para
                editar el sitio de ASO Computación como {ROLE_LABELS[invitation.role].toLowerCase()}.
              </p>
              {/* A plain link, not next/link: it must not be prefetched, it starts a redirect flow. */}
              <Button asChild className="min-h-12 w-full">
                <a href={`/auth/google/start?invite=${encodeURIComponent(token)}`}>Continuar con Google</a>
              </Button>
            </>
          ) : (
            <p className="mt-2 text-mist">Este link ya no es válido: se usó, venció o fue revocado. Pida a quien administra el sitio que le envíe uno nuevo.</p>
          )}
        </section>
      </div>
    </main>
  );
}
