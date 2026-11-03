export interface Toast {
  id: number;
  message: string;
}

/** More than this at once is noise: the oldest makes room. */
export const MAX_TOASTS = 3;

export function pushToast(toasts: readonly Toast[], toast: Toast): Toast[] {
  return [...toasts, toast].slice(-MAX_TOASTS);
}

export function dismissToast(toasts: readonly Toast[], id: number): Toast[] {
  return toasts.filter((toast) => toast.id !== id);
}
