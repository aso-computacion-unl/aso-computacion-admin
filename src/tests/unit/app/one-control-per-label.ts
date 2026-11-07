/**
 * The controls a visible `<label>` can be taken for: the one it names, plus any element whose own `aria-label`
 * carries the label's text (a "?" help toggle called "Ayuda: Cupos", say). `getByLabel('Cupos')` and voice control
 * match a name by its text, so a second hit makes the field ambiguous. Each label should map to exactly one.
 */
export function controlsPerLabel(host: HTMLElement): Map<string, Set<Element>> {
  const named = [...host.querySelectorAll("[aria-label]")];
  const result = new Map<string, Set<Element>>();

  for (const label of host.querySelectorAll("label")) {
    const text = (label.textContent ?? "").trim();
    const matches = new Set<Element>(named.filter((element) => element.getAttribute("aria-label")!.toLowerCase().includes(text.toLowerCase())));

    if (label.control) matches.add(label.control);
    result.set(text, matches);
  }

  return result;
}
