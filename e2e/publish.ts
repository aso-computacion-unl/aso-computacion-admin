import type { Page } from "@playwright/test";

/**
 * A published item (event, FAQ, news, site texts, board member, pillar…) is saved through the full-screen preview: "Publicar" opens it and "Sí, publicar"
 * saves and rebuilds the site. A draft keeps its own save button and does not come through here.
 */
export async function publish(page: Page) {
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await page.getByRole("dialog", { name: "Así queda" }).getByRole("button", { name: "Sí, publicar" }).click();
}

/** The toast and the line next to the button after a publish. */
export const PUBLISHED_TEXT = "Publicado. El sitio se actualiza en un minuto.";
