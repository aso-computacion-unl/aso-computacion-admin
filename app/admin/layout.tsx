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
        <form action={logout}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
