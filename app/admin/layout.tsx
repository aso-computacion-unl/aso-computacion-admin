import type { ReactNode } from "react";

import { BREAK_GLASS_NOTICE, EMERGENCY_LABEL, ROLE_LABELS } from "@/interface/admin/role-labels";
import { logout } from "@/interface/auth/actions";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { AdminThemeDefault } from "../_components/theme-toggle";

import { PhoneTopBar, Rail, TabBar } from "./_components/admin-nav";
import { ProfileCard } from "./_components/profile-card";
import { ToastProvider } from "./_components/toast";
import { UnsavedChangesProvider } from "./_components/unsaved-changes";
import "./timeline.css";

// Every admin page checks the session in the database, so none of them can be prerendered.
export const dynamic = "force-dynamic";

// Server actions run in the page's function. After a mutation `after()` holds it open while the
// landing rebuild debounces (deploy-hook.ts), so the default 10 s would cut it short.
export const maxDuration = 30;

/** The rail's 84px card has room for a short role only. */
const SHORT_ROLE_LABELS = { ADMIN: "Admin", EDITOR: "Editor" } as const;

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * The admin shell (design/system.md «Admin page layout»): the floating rail with the profile card at its foot on
 * desktop; on a phone a top bar with the area's name, the profile row at the top of the page and the floating bottom
 * bar. `main` has no max-width: it runs to the window's edge with the side padding of the breakpoint.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const actor = await requirePageSession();

  const emergency = actor.kind === "break_glass";
  const profile = {
    name: emergency ? EMERGENCY_LABEL : actor.name,
    roleLabel: emergency ? "Emergencia" : ROLE_LABELS[actor.role],
    shortRoleLabel: emergency ? "Emergencia" : SHORT_ROLE_LABELS[actor.role],
    emergency,
    notice: emergency ? BREAK_GLASS_NOTICE : undefined,
    signOut: logout,
  };

  // One "leave without saving?" dialog for the whole admin: the rail, the tab bars, the profile card and the links of every page ask through it.
  return (
    <UnsavedChangesProvider>
      {/* `data-area` turns on the admin's rounded, filled controls in the shared components (`in-data-[area=admin]:`). */}
      <div data-area="admin" className="min-h-screen lg:grid lg:grid-cols-[7rem_minmax(0,1fr)]">
        <AdminThemeDefault />
        <a
          href="#main"
          className="fixed top-[-4rem] left-3 z-100 rounded-full bg-action px-4 py-2.5 font-bold text-on-action focus:top-3"
        >
          Saltar al contenido
        </a>

        <aside className="sticky top-0 z-30 hidden h-dvh py-3 pl-3 lg:block">
          <div className="flex h-full w-22 flex-col items-center gap-4 overflow-y-auto rounded-card bg-deep pt-4 pb-3 text-white">
            <Rail role={actor.role} />
            <div className="mt-auto">
              <ProfileCard variant="rail" {...profile} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <PhoneTopBar />

          <main
            id="main"
            className="w-full px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12 min-[90rem]:px-10 min-[120rem]:px-12"
          >
            <div className="mb-5 lg:hidden">
              <ProfileCard variant="row" {...profile} />
            </div>
            <ToastProvider>{children}</ToastProvider>
          </main>
        </div>

        <TabBar role={actor.role} />
      </div>
    </UnsavedChangesProvider>
  );
}
