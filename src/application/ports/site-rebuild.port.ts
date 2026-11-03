/** When the landing last ACCEPTED a rebuild request (an admin edit or the cron), or `null` when none is on record. */
export interface LastBuildMarker {
  lastSuccessAt(): Promise<Date | null>;
}

/** Asks for a landing rebuild right now. `disabled`: no hook is configured. `failed`: the hook did not accept it. */
export interface SiteRebuildTrigger {
  trigger(): Promise<"accepted" | "failed" | "disabled">;
}
