import type { SocialPlatform } from "@/domain/social-link";

/** How each platform is written by its owner. The form shows these instead of the raw ids. */
export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  twitch: "Twitch",
  youtube: "YouTube",
  github: "GitHub",
  facebook: "Facebook",
  x: "X",
  discord: "Discord",
  whatsapp: "WhatsApp",
};

export function socialPlatformLabel(platform: string): string {
  return (SOCIAL_PLATFORM_LABELS as Record<string, string>)[platform] ?? platform;
}
