import { expect, type Page } from "@playwright/test";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js*";
// Cloudflare's script replaced by a widget that passes at once. It marks its box `data-turnstile="ready"`: React
// mounts the widget in an effect, so by then the form is hydrated. After `reset()` (the form asks for a fresh check
// once a token is used) the new token arrives on its own, as Cloudflare's managed widget does for most visitors: the
// form must keep the server's answer on screen when that happens (issue #122).
const TURNSTILE_STUB = `(() => {
  let options;
  const give = () => options.callback("audit-token");
  window.turnstile = {
    render(box, given) {
      options = given;
      box.dataset.turnstile = "ready";
      setTimeout(give, 0);
      return "stub";
    },
    reset() {
      setTimeout(give, 0);
    },
    remove() {},
  };
})();`;

const stubbed = new WeakSet<Page>();

/** The browser gets a token from a widget that always passes, with no call to Cloudflare. The server still checks it, with the test secret. */
export async function stubTurnstile(page: Page) {
  if (stubbed.has(page)) return;

  stubbed.add(page);
  await page.route(TURNSTILE_SCRIPT, (route) => route.fulfill({ contentType: "text/javascript", body: TURNSTILE_STUB }));
}

/** Waits until the stub widget is mounted: the page is hydrated and the form holds a token, the state a visitor reaches before typing. */
export async function widgetReady(page: Page) {
  await expect(page.locator('[data-turnstile="ready"]')).toBeAttached();
  await expect(page.getByRole("button", { name: /Reservar mi cupo/ })).toBeVisible();
}

/** Opens an event page's form with the stub widget and waits until it is ready. */
export async function openForm(page: Page, slug: string) {
  await stubTurnstile(page);
  await page.goto(`/inscripciones/${slug}`);
  await widgetReady(page);
}
