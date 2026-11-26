import { expect, type Page } from "@playwright/test";

/** Opens a closed editor disclosure by its summary text, and checks it opened. */
async function openDisclosure(page: Page, text: string) {
  const summary = page.getByText(text, { exact: true });
  const details = page.locator("details").filter({ has: summary });

  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await summary.click();

  await expect(details).toHaveAttribute("open", "");
}

/** The editors keep their secondary fields in a closed "Más opciones": open it before filling one. */
export async function openMoreOptions(page: Page) {
  await openDisclosure(page, "Más opciones");
}

/** The event and news editors keep «Publicar el» and «Retirar el» in their publish panel, under a closed «Programar publicación y retiro». */
export async function openSchedule(page: Page) {
  await openDisclosure(page, "Programar publicación y retiro");
}
