"use server";

/*
 * Forum moderation ("Reportes del foro"), open to ADMIN and EDITOR. The report queue page binds these;
 * every one answers `ActionResult` and writes an audit entry after the change succeeded. A hide, lock or
 * suspension that finds the target already in the wanted state answers `{ success: true, unchanged: true }`
 * and writes no entry.
 *
 *   setForumThreadHidden(threadId, hidden)         hide a thread from students, or show it again
 *   setForumReplyHidden(replyId, hidden)           same for a reply (a hidden reply stops being the best answer)
 *   setForumThreadLocked(threadId, locked)         a locked thread takes no replies and no edits
 *   setForumMemberSuspended(memberId, suspended)   suspending also signs the member out of the forum everywhere
 *   closeForumReport(reportId, outcome, note?)     outcome "RESOLVED" or "DISMISSED"; note up to 500 characters
 *
 * Reads for the page: `getAdminForumReports()` in ./forum-moderation-read.
 */

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { ForumReportAlreadyClosedError } from "@/domain/forum";

import { recordAudit } from "../../audit/record-audit";
import { requireSession } from "../../auth/require-session";
import { getForumServices } from "../../forum/forum-container";
import { mapActionError as mapError, type ActionResult } from "../action-result";

// Every action starts with the session guard, before it reads any input or touches a use case (a server
// action can be POSTed to any page). Moderating is editor-level: any signed-in user. Audit summaries carry
// ids only, never a post, a reason, a note or an email.

const MODERATION_PATH = "/admin/foro/reportes";

// Asking for the state a post or account already has (a second moderator got there first) is not an error and
// not an event: the page refreshes to the real state and the audit log stays as it was.
const NO_CHANGE: ActionResult = { success: true, unchanged: true };

const FIELD_MESSAGES = {
  note: "La nota admite hasta 500 caracteres.",
  outcome: "Elija resolver o descartar el reporte.",
};

function mapActionError(error: unknown): ActionResult {
  if (error instanceof ForumReportAlreadyClosedError) {
    return { error: "Otra persona ya cerró este reporte." };
  }

  if (error instanceof NotFoundError) {
    return { error: "No se encontró la publicación, el reporte o la cuenta. Puede que ya no exista." };
  }

  return mapError(error, FIELD_MESSAGES);
}

export async function setForumThreadHidden(threadId: string, hidden: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const hide = hidden === true;

    const { changed } = await getForumServices().setPostHidden.execute({ target: { kind: "thread", id: threadId }, hidden: hide, moderatorId: actor.userId });

    if (changed) {
      await recordAudit(actor, {
        action: hide ? "forum.thread.hide" : "forum.thread.unhide",
        entityType: "forum_thread",
        entityId: threadId,
        summary: hide ? "Hilo del foro oculto" : "Hilo del foro visible de nuevo",
      });
    }

    revalidatePath(MODERATION_PATH);
    return changed ? { success: true } : NO_CHANGE;
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setForumReplyHidden(replyId: string, hidden: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const hide = hidden === true;

    const { changed } = await getForumServices().setPostHidden.execute({ target: { kind: "reply", id: replyId }, hidden: hide, moderatorId: actor.userId });

    if (changed) {
      await recordAudit(actor, {
        action: hide ? "forum.reply.hide" : "forum.reply.unhide",
        entityType: "forum_reply",
        entityId: replyId,
        summary: hide ? "Respuesta del foro oculta" : "Respuesta del foro visible de nuevo",
      });
    }

    revalidatePath(MODERATION_PATH);
    return changed ? { success: true } : NO_CHANGE;
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setForumThreadLocked(threadId: string, locked: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const lock = locked === true;

    const { changed } = await getForumServices().setThreadLocked.execute({ threadId, locked: lock, moderatorId: actor.userId });

    if (changed) {
      await recordAudit(actor, {
        action: lock ? "forum.thread.lock" : "forum.thread.unlock",
        entityType: "forum_thread",
        entityId: threadId,
        summary: lock ? "Hilo del foro cerrado" : "Hilo del foro reabierto",
      });
    }

    revalidatePath(MODERATION_PATH);
    return changed ? { success: true } : NO_CHANGE;
  } catch (error) {
    return mapActionError(error);
  }
}

export async function setForumMemberSuspended(memberId: string, suspended: boolean): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const suspend = suspended === true;

    const { changed } = await getForumServices().setMemberSuspended.execute({ memberId, suspended: suspend, moderatorId: actor.userId });

    if (changed) {
      await recordAudit(actor, {
        action: suspend ? "forum.member.suspend" : "forum.member.reactivate",
        entityType: "forum_member",
        entityId: memberId,
        summary: suspend ? "Cuenta del foro suspendida y sesiones cerradas" : "Cuenta del foro reactivada",
      });
    }

    revalidatePath(MODERATION_PATH);
    return changed ? { success: true } : NO_CHANGE;
  } catch (error) {
    return mapActionError(error);
  }
}

export async function closeForumReport(reportId: string, outcome: "RESOLVED" | "DISMISSED", note?: string): Promise<ActionResult> {
  try {
    const actor = await requireSession();

    if (outcome !== "RESOLVED" && outcome !== "DISMISSED") {
      throw new ValidationError("outcome", "outcome must be RESOLVED or DISMISSED");
    }

    await getForumServices().closeReport.execute({ reportId, outcome, note: typeof note === "string" ? note : null, moderatorId: actor.userId });
    await recordAudit(actor, {
      action: outcome === "RESOLVED" ? "forum.report.resolve" : "forum.report.dismiss",
      entityType: "forum_report",
      entityId: reportId,
      summary: outcome === "RESOLVED" ? "Reporte del foro resuelto" : "Reporte del foro descartado",
    });
    revalidatePath(MODERATION_PATH);
    return { success: true };
  } catch (error) {
    return mapActionError(error);
  }
}
