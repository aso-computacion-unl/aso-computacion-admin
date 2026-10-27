import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";

interface EmptyStateProps {
  /** The module's own icon: what is missing, at a glance. */
  icon: IconName;
  /** One sentence: what the list is for, or why nothing shows. */
  children: ReactNode;
  /** The one next step. */
  action?: ReactNode;
}

/**
 * What a page says when it has nothing to list: an icon, one sentence and the single next step. It fills the width of
 * its container and centers its content, so the page stays symmetric whatever the width.
 */
export function EmptyState({ icon, children, action }: EmptyStateProps) {
  return (
    <div role="status" data-slot="empty-state" className="mt-8 grid w-full justify-items-center gap-4 rounded bg-card p-6 text-center md:p-8">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-xs bg-muted text-sky">
        <Icon name={icon} />
      </span>
      <p className="max-w-prose text-foreground">{children}</p>
      {action}
    </div>
  );
}
