"use client";

import { useRouter } from "next/navigation";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { setForumBestAnswer } from "@/interface/forum/forum-best-answer";

import { InlineError, useInlineAction } from "./use-inline-action";

/** For the author of a thread, on a reply: marks it as the best answer, or takes the mark back. The thread refreshes in place. */
export function BestAnswerButton({ threadId, replyId, isBest }: { threadId: string; replyId: string; isBest: boolean }) {
  const router = useRouter();
  const { pending, error, run } = useInlineAction();

  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        busy={pending}
        aria-disabled={pending || undefined}
        onClick={() =>
          run(
            () => setForumBestAnswer(threadId, isBest ? null : replyId),
            (result) => {
              if (result.success) router.refresh();
            },
          )
        }
      >
        <Icon name="merge" className="size-4" />
        {isBest ? "Quitar de mejor respuesta" : "Marcar como mejor respuesta"}
      </Button>
      <InlineError message={error} />
    </>
  );
}
