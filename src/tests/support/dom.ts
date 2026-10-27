import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// React only batches state updates the way the tests expect when it knows an `act` environment is on.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; host: HTMLElement }[] = [];

/** Renders into a detached-from-nothing div in jsdom; call `unmountAll` in `afterEach`. */
export async function mount(element: ReactElement): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  mounted.push({ root, host });
  await act(async () => root.render(element));

  return host;
}

export async function unmountAll(): Promise<void> {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
}

/** Types into a controlled field the way a browser does, so React sees an `input` event. */
export async function typeInto(field: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;

  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export async function click(element: Element): Promise<void> {
  await act(async () => {
    (element as HTMLElement).click();
  });
}

/** Lets pending promises and transitions settle. */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
