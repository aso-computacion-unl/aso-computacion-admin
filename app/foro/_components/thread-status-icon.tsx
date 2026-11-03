import { Icon } from "@/components/icons";
import type { ThreadStatus } from "@/interface/forum/forum-display";

const STATUS = {
  open: { icon: "dot", label: "Abierto", tone: "text-ok" },
  solved: { icon: "merge", label: "Resuelto", tone: "text-sky-bright" },
  locked: { icon: "lock", label: "Cerrado", tone: "text-mist" },
} as const;

/** The state glyph of a thread: shape and a hidden word, so it never relies on colour alone. */
export function ThreadStatusIcon({ status }: { status: ThreadStatus }) {
  const { icon, label, tone } = STATUS[status];

  return (
    <span className={tone}>
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
