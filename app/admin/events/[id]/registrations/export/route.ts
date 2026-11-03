import { exportEventRegistrationsCsv } from "@/interface/admin/event-registrations/registrations-export";

// Reads the session cookie and personal data: never cached.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return exportEventRegistrationsCsv((await params).id);
}
