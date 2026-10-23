import type { ReactNode } from "react";

import "../content-module.css";

export default function FaqsLayout({ children }: { children: ReactNode }) {
  return <div className="content-module">{children}</div>;
}
