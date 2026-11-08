import { describe, expect, it } from "vitest";

import { CreateEventUseCase } from "@/application/use-cases/create-event.use-case";
import { CreateFaqUseCase } from "@/application/use-cases/create-faq.use-case";
import { CreateNewsItemUseCase } from "@/application/use-cases/create-news-item.use-case";
import { CreateSocialLinkUseCase } from "@/application/use-cases/create-social-link.use-case";
import { CreateTerminalCommandUseCase } from "@/application/use-cases/create-terminal-command.use-case";
import { UpdateBoardMemberUseCase } from "@/application/use-cases/update-board-member.use-case";
import { UpdateEventUseCase } from "@/application/use-cases/update-event.use-case";
import { UpdateFaqUseCase } from "@/application/use-cases/update-faq.use-case";
import { UpdateNewsItemUseCase } from "@/application/use-cases/update-news-item.use-case";
import { UpdatePillarUseCase } from "@/application/use-cases/update-pillar.use-case";
import { UpdateSocialLinkUseCase } from "@/application/use-cases/update-social-link.use-case";
import { UpdateSponsorUseCase } from "@/application/use-cases/update-sponsor.use-case";
import { UpdateTerminalCommandUseCase } from "@/application/use-cases/update-terminal-command.use-case";
import { BoardMember } from "@/domain/board-member";
import type { Faq } from "@/domain/faq";
import { Pillar } from "@/domain/pillar";
import type { SocialLink } from "@/domain/social-link";
import { Sponsor } from "@/domain/sponsor";
import type { TerminalCommand } from "@/domain/terminal-command";
import { InMemoryCommandNameRegistry } from "@/tests/fakes/in-memory-command-name-registry";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

// Every update use case already reads the stored row; it reports whether that row was published BEFORE
// the save, so the action can decide about the site rebuild without trusting the form.

const IMAGE = { url: "https://res.example.test/a.jpg", publicId: "a", width: 1600, height: 900, alt: "Alt" };

interface Subject {
  name: string;
  /** Stores an item with the given publish flag and answers the id and an update that keeps the flag unless told otherwise. */
  seed(isPublished: boolean): Promise<{ id: string; update(isPublished: boolean): Promise<{ wasPublished?: boolean; isPublished: boolean }> }>;
}

const SUBJECTS: Subject[] = [
  {
    name: "events",
    async seed(isPublished) {
      const events = new InMemoryEventRepository();
      const { id } = await new CreateEventUseCase(events).execute({ title: "Taller", isPublished });
      return { id, update: (flag) => new UpdateEventUseCase(events).execute({ id, title: "Taller 2", isPublished: flag }) };
    },
  },
  {
    name: "faqs",
    async seed(isPublished) {
      const faqs = new InMemoryOrderedRepository<Faq>();
      const names = new InMemoryCommandNameRegistry(faqs);
      const { id } = await new CreateFaqUseCase(faqs, names).execute({ question: "¿Cuesta?", answer: "No.", isPublished });
      return { id, update: (flag) => new UpdateFaqUseCase(faqs, names).execute({ id, answer: "Nunca.", isPublished: flag }) };
    },
  },
  {
    name: "news",
    async seed(isPublished) {
      const news = new InMemoryNewsRepository();
      const { id } = await new CreateNewsItemUseCase(news).execute({ title: "Novedad", summary: "Resumen", body: "Cuerpo", isPublished });
      return { id, update: (flag) => new UpdateNewsItemUseCase(news).execute({ id, title: "Novedad 2", isPublished: flag }) };
    },
  },
  {
    name: "board",
    async seed(isPublished) {
      const members = new InMemoryOrderedRepository<BoardMember>();
      const { id } = (await members.create(BoardMember.create({ name: "Ana", role: "Presidenta", sortOrder: 0, photo: IMAGE, isPublished }))).props;
      return { id, update: (flag) => new UpdateBoardMemberUseCase(members).execute({ id, role: "Tesorera", isPublished: flag }) };
    },
  },
  {
    name: "pillars",
    async seed(isPublished) {
      const pillars = new InMemoryOrderedRepository<Pillar>();
      const { id } = (await pillars.create(Pillar.create({ word: "VOZ", title: "Representamos", text: "Texto", sortOrder: 0, image: IMAGE, isPublished }))).props;
      return { id, update: (flag) => new UpdatePillarUseCase(pillars).execute({ id, text: "Otro", isPublished: flag }) };
    },
  },
  {
    name: "commands",
    async seed(isPublished) {
      const commands = new InMemoryOrderedRepository<TerminalCommand>();
      const names = new InMemoryCommandNameRegistry(new InMemoryOrderedRepository<Faq>(), commands);
      const { id } = await new CreateTerminalCommandUseCase(commands, names).execute({ command: "horario", description: "Cuándo", output: "Martes.", isPublished });
      return { id, update: (flag) => new UpdateTerminalCommandUseCase(commands, names).execute({ id, output: "Jueves.", isPublished: flag }) };
    },
  },
  {
    name: "sponsors",
    async seed(isPublished) {
      const sponsors = new InMemoryOrderedRepository<Sponsor>();
      const { id } = (await sponsors.create(Sponsor.create({ name: "Acme", sortOrder: 0, logo: IMAGE, isPublished }))).props;
      return { id, update: (flag) => new UpdateSponsorUseCase(sponsors).execute({ id, name: "Acme 2", isPublished: flag }) };
    },
  },
  {
    name: "socials",
    async seed(isPublished) {
      const links = new InMemoryOrderedRepository<SocialLink>();
      const { id } = await new CreateSocialLinkUseCase(links).execute({ platform: "tiktok", label: "TikTok", handle: "@aso", url: "https://www.tiktok.com/@aso", isPublished });
      return { id, update: (flag) => new UpdateSocialLinkUseCase(links).execute({ id, label: "TikTok 2", isPublished: flag }) };
    },
  },
];

describe.each(SUBJECTS)("the $name update use case", ({ seed }) => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])("stored published %s, saved as published %s -> reports wasPublished %s and the new flag", async (before, after) => {
    const { update } = await seed(before);

    expect(await update(after)).toMatchObject({ wasPublished: before, isPublished: after });
  });
});
