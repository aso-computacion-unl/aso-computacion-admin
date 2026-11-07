import { redirect } from "next/navigation";

// The registrants live on the Inscripciones screen now; this address stays so old links and bookmarks keep working.
export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  redirect(`/admin/registrations?evento=${encodeURIComponent(id)}`);
}
