"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { toggleForumReplyReaction, toggleForumThreadReaction } from "@/interface/forum/forum-helpful";

import { InlineError, useInlineAction } from "./use-inline-action";

/** «Me sirvió» on a post (the opening post or a reply): a toggle with the count. It answers at once and goes back if the server refuses. */
export function ReactionButton({ target, count, mine }: { target: { kind: "thread" | "reply"; id: string }; count: number; mine: boolean }) {
  const [state, setState] = useState({ count, mine });
  const { pending, error, run } = useInlineAction();

  function toggle() {
    const before = state;

    setState({ count: before.mine ? before.count - 1 : before.count + 1, mine: !before.mine });
    run(
      () => (target.kind === "thread" ? toggleForumThreadReaction(target.id) : toggleForumReplyReaction(target.id)),
      (result) => setState(result.success && typeof result.reacted === "boolean" && typeof result.count === "number" ? { count: result.count, mine: result.reacted } : before),
    );
  }

  return (
    <>
      <Button variant="quiet" size="sm" aria-pressed={state.mine} aria-disabled={pending || undefined} onClick={toggle} className={state.mine ? "text-sky-bright" : undefined}>
        <Icon name="star" className="size-4" />
        Me sirvió
        <span className="font-mono text-xs tabular-nums">{state.count}</span>
      </Button>
      <InlineError message={error} />
    </>
  );
}
