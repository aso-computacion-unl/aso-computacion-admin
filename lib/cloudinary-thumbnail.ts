const IMAGE_DELIVERY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
// Transformations come first and the version (`v1700000000`) marks where they end.
const BEFORE_VERSION = /^((?:[^/]+\/)*?)(v\d+\/.+)$/;

/**
 * URL of a Cloudinary image sized for a thumbnail shown `width` (× `height`) CSS pixels wide.
 * Asks for twice that, so it stays sharp on dense screens, as `f_auto,q_auto`. With a
 * `height` the image fills the box (`c_fill`); without one it keeps its aspect ratio
 * (`c_limit`, which also never upscales). Any other URL is returned unchanged.
 */
export function thumbnailUrl(url: string, width: number, height?: number): string {
  const delivery = IMAGE_DELIVERY.exec(url);

  if (!delivery || !Number.isFinite(width) || width <= 0) return url;

  const [, prefix = "", rest = ""] = delivery;
  const size = height === undefined ? `w_${Math.round(width * 2)},c_limit` : `w_${Math.round(width * 2)},h_${Math.round(height * 2)},c_fill`;
  const transformation = `${size},f_auto,q_auto`;
  // Ours goes after any transformation already in the URL, so the resize is the last step.
  const [, existing = "", tail = rest] = BEFORE_VERSION.exec(rest) ?? [];

  return `${prefix}${existing}${transformation}/${tail}`;
}
