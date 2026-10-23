import type { ReactNode } from "react";

import "../content-module.css";

export default function SocialsLayout({ children }: { children: ReactNode }) {
  return <div className="content-module">{children}</div>;
}
