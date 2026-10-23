import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/interface/auth/actions";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <strong>ASO Computación</strong>
        <nav aria-label="Administración">
          <Link href="/admin">Inicio</Link> <Link href="/admin/events">Eventos</Link>{" "}
          <Link href="/admin/faqs">Preguntas frecuentes</Link> <Link href="/admin/socials">Redes</Link>
        </nav>
        <form action={logout}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
