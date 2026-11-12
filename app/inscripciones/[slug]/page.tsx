import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";
import { parseForumLoginError } from "@/interface/forum/forum-login-errors";

import { RegistrationView } from "./registration-view";

// Reads the session cookie and the live seat count: never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Evento e inscripción", robots: { index: false } };

type Param = string | string[] | undefined;

export default async function EventRegistrationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: Param }> }) {
  const [{ slug }, { error }] = await Promise.all([params, searchParams]);
  const page = await getEventRegistrationPage(slug);

  if (!page) notFound();

  // A sign-in that failed comes back here with its code (`?error=`); anything else is ignored.
  return <RegistrationView page={page} slug={slug} problem={parseForumLoginError(error)} />;
}
