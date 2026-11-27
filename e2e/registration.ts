import type { Page } from "@playwright/test";

const MODE_LABELS = { unl: "Cuenta UNL", open: "Formulario abierto" } as const;

/**
 * Event-kinds S3: on the new event form of Eventos, picks «Evento con inscripción» and how people sign up. The form
 * must be hydrated first: a radio clicked before that is reset when React takes the form over.
 */
export async function chooseRegistration(page: Page, { mode, capacity }: { mode: keyof typeof MODE_LABELS; capacity?: number }) {
  await page.getByRole("radio", { name: "Evento con inscripción", exact: true }).check();
  await page.getByRole("radio", { name: MODE_LABELS[mode] }).check();

  if (capacity !== undefined) await page.getByLabel("Cupos").fill(String(capacity));
}
