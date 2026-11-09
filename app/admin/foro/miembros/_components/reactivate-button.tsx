"use client";

import { Button } from "@/components/ui/button";
import { setForumMemberSuspended } from "@/interface/admin/forum/moderation-actions";

import { FieldError } from "../../../_components/form-parts";
import { useToast } from "../../../_components/toast";
import { resultMessage, useRunAction } from "../../../_components/use-run-action";
import { ALREADY_DONE_MESSAGE } from "../../reportes/_components/report-controls";

/**
 * «Reactivar la cuenta» for a suspended member: the report queue's own action, so the rules, the audit entry and the
 * messages are the same. A second moderator who got there first is told nothing changed instead of being thanked.
 */
export function ReactivateButton({ memberId, name }: { memberId: string; name: string }) {
  const { pending, result, run } = useRunAction();
  const { notify } = useToast();
  const message = resultMessage(result);
  const reactivate = async () => {
    const outcome = await setForumMemberSuspended(memberId, false);

    if (outcome.success) notify(outcome.unchanged ? ALREADY_DONE_MESSAGE : "Cuenta reactivada.");

    return outcome;
  };

  return (
    <div className="grid justify-items-start gap-2">
      <Button variant="line" size="sm" busy={pending} aria-disabled={pending || undefined} aria-label={`Reactivar la cuenta: ${name}`} onClick={() => !pending && run(reactivate)}>
        Reactivar la cuenta
      </Button>
      {message ? <FieldError>{message}</FieldError> : null}
    </div>
  );
}
