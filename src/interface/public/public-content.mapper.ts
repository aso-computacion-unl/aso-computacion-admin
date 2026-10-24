import type { PublicContentSnapshot } from "@/application/dto/public-content.dto";

import type { PublicContentResponse, PublicImage } from "./public-content.dto";

export const PUBLIC_CONTENT_VERSION = 1;

// Every object below is built key by key, never spread: a field added to an
// entity later stays private until someone adds it here on purpose.
const toPublicImage = ({ url, width, height, alt }: PublicImage): PublicImage => ({ url, width, height, alt });

export function toPublicContentResponse(snapshot: PublicContentSnapshot, generatedAt: Date): PublicContentResponse {
  return {
    version: PUBLIC_CONTENT_VERSION,
    generatedAt: generatedAt.toISOString(),
    events: snapshot.events.map((event) => ({
      slug: event.slug,
      title: event.title,
      description: event.description,
      date: event.datePrecision === "month" && event.date ? `${event.date.slice(0, 7)}-01` : event.date,
      datePrecision: event.date ? event.datePrecision : "day",
      type: event.type,
      commitMessage: event.commitMessage,
      hora: event.hora,
      lugar: event.lugar,
      para: event.para,
      featured: event.featured,
      linkUrl: event.linkUrl,
      linkLabel: event.linkLabel,
      highlights: [...event.highlights],
      photos: event.photos.map(toPublicImage),
    })),
    faqs: snapshot.faqs.map((faq) => ({ question: faq.question, answer: faq.answer, command: faq.command })),
    pillars: snapshot.pillars.map((pillar) => ({
      word: pillar.word,
      title: pillar.title,
      text: pillar.text,
      image: pillar.image && toPublicImage(pillar.image),
    })),
    socials: snapshot.socials.map((social) => ({
      platform: social.platform,
      label: social.label,
      handle: social.handle,
      url: social.url,
      note: social.note,
      blurb: social.blurb,
    })),
    // A published member always has a photo (domain rule and DB CHECK); the flatMap
    // keeps the landing's type honest even if that invariant were ever broken.
    board: snapshot.board.flatMap((member) =>
      member.photo ? [{ name: member.name, role: member.role, photo: toPublicImage(member.photo) }] : [],
    ),
    settings: snapshot.settings && {
      tagline: snapshot.settings.tagline,
      description: snapshot.settings.description,
      about: snapshot.settings.about,
    },
    news: snapshot.news.map((item) => ({
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      body: item.body,
      publishedAt: item.publishedAt,
      cover: item.cover && toPublicImage(item.cover),
    })),
    commands: snapshot.commands.map((item) => ({
      id: item.id,
      command: item.command,
      description: item.description,
      output: item.output,
    })),
  };
}
