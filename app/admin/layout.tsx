import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BREAK_GLASS_NOTICE, EMERGENCY_LABEL, ROLE_LABELS } from "@/interface/admin/role-labels";
import { logout } from "@/interface/auth/actions";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { AppTopBar } from "../_components/app-top-bar";
import { IdentityChip } from "../_components/identity-chip";

import { SideNav, TabBar } from "./_components/admin-nav";
import { ToastProvider } from "./_components/toast";
import "./timeline.css";

// Every admin page checks the session in the database, so none of them can be prerendered.
export const dynamic = "force-dynamic";

// Server actions run in the page's function. After a mutation `after()` holds it open while the
// landing rebuild debounces (deploy-hook.ts), so the default 10 s would cut it short.
export const maxDuration = 30;

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const actor = await requirePageSession();

  const emergency = actor.kind === "break_glass";

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="fixed top-[-4rem] left-3 z-100 rounded bg-sky px-4 py-2.5 font-bold text-primary-foreground focus:top-3"
      >
        Saltar al contenido
      </a>

      <AppTopBar productName="Admin ASO" homeHref="/admin" homeLabel="ASO Computación, inicio de la administración">
        <IdentityChip
          name={emergency ? undefined : actor.name}
          roleLabel={emergency ? EMERGENCY_LABEL : ROLE_LABELS[actor.role]}
          emergency={emergency}
          notice={emergency ? BREAK_GLASS_NOTICE : undefined}
          signOut={
            <form action={logout}>
              <Button variant="quiet" type="submit" className="w-full justify-start">
                <Icon name="out" />
                Cerrar sesión
              </Button>
            </form>
          }
        />
      </AppTopBar>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* --sidebar-chrome: everything in the viewport that is not nav rows: the 3.5rem top bar, the three group labels, the gaps between groups and the aside's padding; the rows share the rest. */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col bg-muted px-3 py-3 shadow-[1px_0_0_var(--color-border)] [--sidebar-chrome:9.6rem] lg:flex">
          <SideNav role={actor.role} />
        </aside>

        <main id="main" className="mx-auto w-full max-w-360 px-4 pt-5 pb-[calc(4.25rem+5rem)] lg:px-10 lg:pt-8 lg:pb-24 xl:px-12">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>

      <TabBar role={actor.role} />
    </div>
  );
}
