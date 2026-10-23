import type { ReactNode } from "react";

import "../content-module.css";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return <div className="content-module">{children}</div>;
}
