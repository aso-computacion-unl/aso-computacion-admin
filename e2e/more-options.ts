import { expect, type Page } from "@playwright/test";

/** The event and FAQ editors keep their secondary fields in a closed "Más opciones": open it before filling one. */
export async function openMoreOptions(page: Page) {
  const summary = page.getByText("Más opciones", { exact: true });
  const details = page.locator("details").filter({ has: summary });

  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await summary.click();

  await expect(details).toHaveAttribute("open", "");
}
