import { expect, test, type Page } from "@playwright/test";

// The forum login needs a real Google account, so this suite covers what a visitor can see and what stays
// closed to them. Signed-in screens are covered by the unit tests over the in-memory forum.
// This server has no FORUM_* variables, so the forum login is switched off, as it is until the owner sets them up.
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  expect(overflow).toBeLessThanOrEqual(0);
}

test("a visitor at /foro sees the sign-in and none of the forum, on a phone too", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/foro");

  await expect(page.getByRole("heading", { level: 1, name: "Su carrera se resuelve aquí" })).toBeVisible();
  for (const reason of ["Preguntar", "Proponer", "Armar equipo"]) await expect(page.getByRole("heading", { level: 2, name: reason })).toBeVisible();
  await expect(page.getByText("Solo con su correo @unl.edu.ec. La primera vez se crea su cuenta.")).toBeVisible();
  await expect(page.getByText("Hilos de ejemplo")).toHaveCount(0);
  const signIn = page.getByRole("link", { name: "Entrar con Google" });
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute("href", "/foro/auth/google/start");
  // The way in is on the first screen of a phone, not below the reasons.
  await expect(signIn).toBeInViewport();
  await expect(page.getByRole("link", { name: "Cerrar sesión" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Menú de cuenta/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Hilos" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("a visitor is sent back to the sign-in from every member-only page", async ({ page }) => {
  for (const path of ["/foro/c/programacion", "/foro/c/programacion/nuevo", "/foro/hilo/nope"]) {
    await page.goto(path);

    await expect(page, path).toHaveURL(`/foro?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("link", { name: "Entrar con Google" })).toHaveAttribute(
      "href",
      `/foro/auth/google/start?next=${encodeURIComponent(path)}`,
    );
  }
});

test("with the forum login switched off, trying to sign in says it is unavailable", async ({ page }) => {
  await page.goto("/foro");
  await page.getByRole("link", { name: "Entrar con Google" }).click();

  await expect(page).toHaveURL(/\/foro\?error=unavailable$/);
  // Filtered by its text: Next's route announcer is a role="alert" too, so a bare `getByRole("alert")` is ambiguous.
  await expect(page.getByRole("alert").filter({ hasText: "El acceso al foro no está disponible ahora." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar de nuevo con Google" })).toBeVisible();
});

// F1 (docs/JOURNEYS.md): the code of a failed sign-in is told above the button, in the words of the table of F1.
const LANDING_ERRORS = [
  ["unavailable", "El acceso al foro no está disponible ahora. Intente más tarde."],
  ["failed", "No se pudo completar el acceso con Google. Inténtelo de nuevo."],
  ["denied", "Solo pueden entrar estudiantes con su cuenta institucional verificada."],
  ["suspended", "Su cuenta del foro está suspendida. Para resolverlo, escriba a la directiva de ASO."],
  ["verification", "No pudimos verificar su cuenta con Google en este momento. Inténtelo de nuevo en unos minutos."],
] as const;

test("F1: every failed sign-in code is told in its own words and the button offers to try again; an unknown code says nothing", async ({ page }) => {
  for (const [code, message] of LANDING_ERRORS) {
    await page.goto(`/foro?error=${code}`);

    await expect(page.getByRole("heading", { level: 1, name: "Su carrera se resuelve aquí" }), code).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: message }), code).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar de nuevo con Google" }), code).toHaveAttribute("href", "/foro/auth/google/start");
  }

  // The gate only knows its own codes: anything else is a plain gate, with no alert and the first-time button.
  for (const unknown of ["hackeado", "Denied", "%3Cscript%3E", "suspended%20"]) {
    await page.goto(`/foro?error=${unknown}`);

    await expect(page.getByRole("link", { name: "Entrar con Google" }), unknown).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar de nuevo con Google" }), unknown).toHaveCount(0);
    for (const [, message] of LANDING_ERRORS) await expect(page.getByText(message), unknown).toHaveCount(0);
  }
});

test("F2: the way back after signing in is kept only for the forum and the event registration pages; anything else is ignored", async ({ page }) => {
  const signInHref = async (next: string) => {
    await page.goto(`/foro?next=${encodeURIComponent(next)}`);

    return page.getByRole("link", { name: "Entrar con Google" }).getAttribute("href");
  };

  expect(await signInHref("/foro/hilo/un-hilo")).toBe(`/foro/auth/google/start?next=${encodeURIComponent("/foro/hilo/un-hilo")}`);
  expect(await signInHref("/inscripciones/un-evento")).toBe(`/foro/auth/google/start?next=${encodeURIComponent("/inscripciones/un-evento")}`);

  for (const foreign of ["https://evil.example/foro", "//evil.example/foro", "/admin", "/inscripciones", "/foro/auth/google/start", "/foro\\evil", "/foro//evil"]) {
    expect(await signInHref(foreign), foreign).toBe("/foro/auth/google/start");
  }
});

test("F3: with the forum login switched off, neither step of the Google sign-in gets going and both send the person back to the landing", async ({ request }) => {
  for (const path of ["/foro/auth/google/start", "/foro/auth/google/start?next=%2Fforo%2Fhilo%2Fun-hilo", "/foro/auth/google/callback", "/foro/auth/google/callback?code=x&state=y", "/foro/auth/google/callback?error=access_denied"]) {
    const answer = await request.get(path, { maxRedirects: 0 });

    expect(answer.status(), path).toBe(307);
    expect(new URL(answer.headers().location ?? "", "http://127.0.0.1").pathname + new URL(answer.headers().location ?? "", "http://127.0.0.1").search, path).toBe("/foro?error=unavailable");
    // Nothing was opened: no session cookie, and the answer is not cached.
    expect(answer.headers()["set-cookie"] ?? "", path).not.toContain("forum_sid");
    expect(answer.headers()["cache-control"], path).toBe("no-store");
  }
});

test("an admin session is not a forum member", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/foro");

  await expect(page.getByRole("link", { name: "Entrar con Google" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hilos" })).toHaveCount(0);

  await page.goto("/foro/c/programacion");
  await expect(page).toHaveURL(`/foro?next=${encodeURIComponent("/foro/c/programacion")}`);
});
