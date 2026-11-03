import type { ReactNode } from "react";

interface ForumShellProps {
  /** The `ForumRail` of the page. */
  rail: ReactNode;
  children: ReactNode;
}

/** The wide frame of the forum's pages: a rail as tall as the screen under the top bar, then the page. */
export function ForumShell({ rail, children }: ForumShellProps) {
  return (
    <div data-wide className="lg:grid lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)]">
      {rail}
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10">{children}</div>
    </div>
  );
}
