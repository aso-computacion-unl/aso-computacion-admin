import { expect, type Page } from "@playwright/test";

const MODE_LABELS = { unl: "Cuenta UNL", open: "Formulario abierto" } as const;

/**
 * R8 (S3): a registration is created only from Inscripciones, on «Crear inscripción» of an upcoming event without one.
 * Lands on the panel with that event selected.
 */
export async function createRegistration(page: Page, eventId: string, { mode, capacity }: { mode: keyof typeof MODE_LABELS; capacity?: number }) {
  // Wait for the form to hydrate: a radio clicked before that is reset when React takes the form over.
  await page.goto(`/admin/registrations/new?evento=${eventId}`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: MODE_LABELS[mode] }).check();

  if (capacity !== undefined) await page.getByLabel("Cupos").fill(String(capacity));

  await page.getByRole("button", { name: "Crear inscripción" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/registrations\\?evento=${eventId}$`));
}
