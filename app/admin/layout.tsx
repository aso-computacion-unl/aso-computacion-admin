import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BREAK_GLASS_NOTICE, sessionLabel } from "@/interface/admin/role-labels";
import { logout } from "@/interface/auth/actions";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { BrandIsotype } from "../_components/brand-mark";
import { ThemeToggle } from "../_components/theme-toggle";

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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="fixed top-[-4rem] left-3 z-100 rounded bg-sky px-4 py-2.5 font-bold text-primary-foreground focus:top-3"
      >
        Saltar al contenido
      </a>

      {/* --sidebar-chrome: the brand row, the group labels, the footer and the padding; the nav rows share the rest. */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1.5 bg-muted px-3 py-3 shadow-[1px_0_0_var(--color-border)] [--sidebar-chrome:12.5rem] lg:flex">
        <Link
          href="/admin"
          aria-label="ASO Computación, inicio de la administración"
          className="flex h-9 shrink-0 items-center gap-2.5 rounded px-2"
        >
          <BrandIsotype width={24} height={27} />
          <span className="font-display text-base tracking-[0.01em]">Admin ASO</span>
        </Link>
        <SideNav role={actor.role} />
        <div className="flex shrink-0 items-center gap-1 border-t border-border pt-2">
          <p className="line-clamp-2 min-w-0 flex-1 px-2 font-mono text-xs leading-tight text-mist">{sessionLabel(actor)}</p>
          <ThemeToggle />
          <form action={logout}>
            <Button variant="quiet" size="icon" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
              <Icon name="out" />
            </Button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-muted pr-2 pl-4 shadow-[0_1px_0_var(--color-border)] lg:hidden">
        <Link href="/admin" aria-label="ASO Computación, inicio de la administración" className="flex items-center gap-3">
          <BrandIsotype width={26} height={29} />
          <span className="font-display text-lg tracking-[0.01em]">Admin ASO</span>
        </Link>
        <ThemeToggle className="ml-auto" />
        <form action={logout}>
          <Button variant="quiet" size="icon" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="out" />
          </Button>
        </form>
      </header>

      <main id="main" className="mx-auto w-full max-w-360 px-4 pt-5 pb-[calc(4.25rem+5rem)] lg:px-10 lg:pt-8 lg:pb-24 xl:px-12">
        {actor.kind === "break_glass" ? (
          <p role="note" className="mb-5 flex items-start gap-2 border-l-2 border-signal bg-signal/10 px-3 py-2 text-sm">
            <Icon name="alert" className="mt-px size-4 shrink-0 text-signal" />
            {BREAK_GLASS_NOTICE}
          </p>
        ) : null}
        <ToastProvider>{children}</ToastProvider>
      </main>

      <TabBar role={actor.role} />
    </div>
  );
}
