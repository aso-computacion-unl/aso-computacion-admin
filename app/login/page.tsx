import type { Metadata } from "next";

import { login } from "@/interface/auth/actions";

import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Acceso — ASO Computación",
  description: "Acceso administrativo para ASO Computación.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Panel de administración</h1>
        <p>Ingrese su contraseña para acceder al panel de ASO Computación.</p>
        <LoginForm action={login} />
      </section>
    </main>
  );
}
