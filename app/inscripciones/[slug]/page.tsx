import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

import { RegistrationView } from "./registration-view";

// Reads the session cookie and the live seat count: never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Evento e inscripción", robots: { index: false } };

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getEventRegistrationPage(slug);

  if (!page) notFound();

  return <RegistrationView page={page} slug={slug} />;
}
