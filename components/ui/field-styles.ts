/**
 * Shared look of every text control. The outline is the 3:1 `input` token; an invalid control
 * switches to a thicker `error` outline so the state does not rely on colour alone (it also
 * carries `aria-invalid` and a message under it).
 */
export const fieldClasses = [
  "block w-full min-h-11 rounded border border-input bg-muted px-3 py-2 text-white",
  "placeholder:text-mist/80",
  "transition-colors duration-150 ease-out",
  "hover:border-mist/65",
  "focus-visible:border-sky focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky",
  "disabled:cursor-not-allowed disabled:opacity-55",
  "aria-[invalid=true]:border-2 aria-[invalid=true]:border-error aria-[invalid=true]:px-[calc(0.75rem-1px)] aria-[invalid=true]:py-[calc(0.5rem-1px)]",
].join(" ");
