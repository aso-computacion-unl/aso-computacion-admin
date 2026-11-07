import { redirect } from "next/navigation";

import { requirePageSession } from "@/interface/auth/require-page-session";

import { ajustesTarget } from "../_components/nav-items";

// Ajustes is an area, not a page: it opens the first tab the signed-in role can use (editors cannot open the team).
export const dynamic = "force-dynamic";

export default async function AdminAjustesPage() {
  const actor = await requirePageSession();

  redirect(ajustesTarget(actor.role));
}
