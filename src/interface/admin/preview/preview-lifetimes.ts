import { PREVIEW_TOKEN_TTL_SECONDS, type PreviewTokenLifetime } from "@/infrastructure/preview/preview-token";

/** The menu of the preview page, in order, with the label the editor reads. */
export const PREVIEW_LIFETIME_OPTIONS: readonly { value: PreviewTokenLifetime; label: string }[] = [
  { value: "1h", label: "1 hora" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 días" },
];

export const DEFAULT_PREVIEW_LIFETIME: PreviewTokenLifetime = "24h";

export function parsePreviewLifetime(value: unknown): PreviewTokenLifetime | undefined {
  return typeof value === "string" && Object.hasOwn(PREVIEW_TOKEN_TTL_SECONDS, value) ? (value as PreviewTokenLifetime) : undefined;
}

export function previewLifetimeLabel(lifetime: PreviewTokenLifetime): string {
  return PREVIEW_LIFETIME_OPTIONS.find((option) => option.value === lifetime)?.label ?? lifetime;
}
