import { describe, expect, it } from "vitest";

import { SOCIAL_PLATFORMS } from "@/domain/social-link";
import { SOCIAL_PLATFORM_LABELS, socialPlatformLabel } from "@/interface/admin/socials/platform-labels";

describe("social platform labels", () => {
  it("has a display name for every platform the domain accepts, and nothing else", () => {
    expect(Object.keys(SOCIAL_PLATFORM_LABELS).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
  });

  it("never shows a raw id: each label differs from its id or is the brand's own spelling", () => {
    expect(socialPlatformLabel("instagram")).toBe("Instagram");
    expect(socialPlatformLabel("tiktok")).toBe("TikTok");
    expect(socialPlatformLabel("linkedin")).toBe("LinkedIn");
    expect(socialPlatformLabel("youtube")).toBe("YouTube");
    expect(socialPlatformLabel("github")).toBe("GitHub");
    expect(socialPlatformLabel("whatsapp")).toBe("WhatsApp");
    expect(socialPlatformLabel("x")).toBe("X");
  });

  it("falls back to the id for a platform it does not know instead of throwing", () => {
    expect(socialPlatformLabel("mastodon")).toBe("mastodon");
  });
});
