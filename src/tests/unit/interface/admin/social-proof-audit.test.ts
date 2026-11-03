import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, containers } = vi.hoisted(() => {
  const useCases = () => ({
    create: { execute: vi.fn(async () => ({ id: "item-1" })) },
    update: { execute: vi.fn(async () => ({ id: "item-1" })) },
    setPublished: { execute: vi.fn(async () => ({ id: "item-1" })) },
    trash: { execute: vi.fn(async () => ({ wasPublished: true })) },
    move: { execute: vi.fn(async () => undefined) },
    setPhoto: { execute: vi.fn(async () => ({ id: "item-1" })) },
    setLogo: { execute: vi.fn(async () => ({ id: "item-1" })) },
    removePhoto: { execute: vi.fn(async () => ({ id: "item-1" })) },
    removeLogo: { execute: vi.fn(async () => ({ id: "item-1" })) },
  });

  return { cookiesMock: vi.fn(), containers: { impact: useCases(), testimonials: useCases(), sponsors: useCases() } };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/interface/admin/impact/impact-container", () => ({ getImpactStatUseCases: () => containers.impact }));
vi.mock("@/interface/admin/testimonials/testimonials-container", () => ({ getTestimonialUseCases: () => containers.testimonials }));
vi.mock("@/interface/admin/sponsors/sponsors-container", () => ({ getSponsorUseCases: () => containers.sponsors }));

import * as impact from "@/interface/admin/impact/actions";
import * as sponsors from "@/interface/admin/sponsors/actions";
import * as testimonials from "@/interface/admin/testimonials/actions";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const SECRET_QUOTE = "FRASE-PRIVADA-DEL-TESTIMONIO";
const SECRET_NAME = "NOMBRE-PRIVADO-DE-PERSONA";
const SECRET_URL = "https://enlace-privado.example/aliados";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function outcomeOf(call: () => Promise<unknown>) {
  try {
    await call();
  } catch (error) {
    if (!(error instanceof Error && error.message === "REDIRECT")) throw error;
  }
}

describe("social proof audit entries carry no content", () => {
  beforeEach(async () => {
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    cookieJar(cookiesMock, await signInAs("EDITOR"));
  });

  it("never records a quote, a person's name, a statistic or a link, only what was done to which item", async () => {
    await outcomeOf(() => testimonials.createTestimonial(null, form({ quote: SECRET_QUOTE, name: SECRET_NAME, role: "Egresada" })));
    await outcomeOf(() => testimonials.updateTestimonial("item-1", null, form({ quote: SECRET_QUOTE, name: SECRET_NAME, role: "Docente" })));
    await outcomeOf(() => sponsors.createSponsor(null, form({ name: SECRET_NAME, url: SECRET_URL })));
    await outcomeOf(() => sponsors.updateSponsor("item-1", null, form({ name: SECRET_NAME, url: SECRET_URL })));
    await outcomeOf(() => impact.createImpactStat(null, form({ value: "VALOR-PRIVADO-9999", label: SECRET_QUOTE })));
    await outcomeOf(() => impact.updateImpactStat("item-1", null, form({ value: "VALOR-PRIVADO-9999", label: SECRET_QUOTE })));

    const recorded = JSON.stringify(testAuth.audit.entries);

    expect(testAuth.audit.entries.map((entry) => entry.action).sort()).toEqual([
      "impact.create",
      "impact.update",
      "sponsor.create",
      "sponsor.update",
      "testimonial.create",
      "testimonial.update",
    ]);
    for (const secret of [SECRET_QUOTE, SECRET_NAME, SECRET_URL, "VALOR-PRIVADO-9999", "Egresada", "Docente"]) {
      expect(recorded).not.toContain(secret);
    }
    expect(testAuth.audit.entries.every((entry) => entry.entityId === "item-1")).toBe(true);
  });
});
