import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { logout } from "@/interface/auth/actions";

import { BrandIsotype, BrandLogo } from "../_components/brand-mark";
import { ThemeToggle } from "../_components/theme-toggle";

import { SideNav, TabBar } from "./_components/admin-nav";
import "./timeline.css";

// Server actions run in the page's function. After a mutation `after()` holds it open while the
// landing rebuild debounces (deploy-hook.ts), so the default 10 s would cut it short.
export const maxDuration = 30;

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="fixed top-[-4rem] left-3 z-100 rounded bg-sky px-4 py-2.5 font-bold text-primary-foreground focus:top-3"
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col gap-7 bg-muted px-4 py-6 shadow-[1px_0_0_var(--color-border)] lg:flex">
        <Link href="/admin" aria-label="ASO Computación, inicio de la administración" className="block px-2 py-1">
          <BrandLogo width={152} className="h-auto w-38" />
        </Link>
        <SideNav />
        <div className="mt-auto grid gap-2 border-t border-border pt-4">
          <p className="px-2 font-mono text-[0.8125rem] text-mist">Sesión: directiva</p>
          <ThemeToggle showLabel className="w-full justify-start" />
          <form action={logout}>
            <Button variant="quiet" type="submit" className="w-full justify-start">
              <Icon name="out" />
              Cerrar sesión
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
        {children}
      </main>

      <TabBar />
    </div>
  );
}
