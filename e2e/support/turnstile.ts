import { expect, type Page } from "@playwright/test";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js*";
// Cloudflare's script replaced by a widget that passes at once. It marks its box `data-turnstile="ready"`: React
// mounts the widget in an effect, so by then the form is hydrated. After `reset()` (the form asks for a fresh check
// once a token is used) the new token arrives only at the person's next click, not on its own: the form clears its
// alert when a token arrives, and one that came a few milliseconds after the answer would erase the very message a
// test is looking for (Cloudflare's real widget takes about a second, which no test could count on). It is at the
// click, not the pointer-down, so removing the alert cannot move the button from under the pointer mid-click.
const TURNSTILE_STUB = `(() => {
  let options;
  const give = () => {
    document.removeEventListener("click", give, true);
    options.callback("audit-token");
  };
  window.turnstile = {
    render(box, given) {
      options = given;
      box.dataset.turnstile = "ready";
      setTimeout(give, 0);
      return "stub";
    },
    reset() {
      document.addEventListener("click", give, true);
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
