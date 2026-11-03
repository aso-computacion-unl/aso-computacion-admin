import { formatAbsoluteTime, formatRelativeTime } from "@/interface/forum/forum-display";

/** "hace 12 min", with the exact moment as a tooltip and in the machine-readable attribute. */
export function PostTime({ date, now }: { date: Date; now: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatAbsoluteTime(date)}>
      {formatRelativeTime(date, now)}
    </time>
  );
}
