import type { ReactNode } from "react";

interface ThreadListEmptyProps {
  title: string;
  /** What to do, or why it is empty. */
  children: ReactNode;
  action?: ReactNode;
}

/** An empty thread list in a line or two, with the way out when there is one. */
export function ThreadListEmpty({ title, children, action }: ThreadListEmptyProps) {
  return (
    <div className="grid justify-items-center gap-4 px-4 py-10 text-center text-mist">
      <p>
        <strong className="mb-1 block text-foreground">{title}</strong>
        {children}
      </p>
      {action}
    </div>
  );
}
