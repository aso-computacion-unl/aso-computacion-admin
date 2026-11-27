import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/interface/forum/forum-display";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "../../_components/theme-toggle";

import { GuardedForm, GuardedLink } from "./unsaved-changes";

interface ProfileCardProps {
  /** `rail`: the 84px card at the foot of the desktop rail. `row`: the full-width row at the top of a phone's page. */
  variant: "rail" | "row";
  /** The signed-in person's name, or the emergency label for the password session (it has no account). */
  name: string;
  /** The role as the row reads it ("Administrador", "Editor", "Emergencia"). */
  roleLabel: string;
  /** The rail's narrow card abbreviates it ("Admin"). */
  shortRoleLabel: string;
  emergency: boolean;
  /** Explains the emergency session: the card's title and its accessible description. */
  notice?: string;
  signOut: (formData: FormData) => void | Promise<void>;
}

/**
 * Who is signed in, always in sight: avatar, name, role and three actions as named icons (Mis sesiones, the theme,
 * Cerrar sesión). In the emergency session the whole card turns tint-red, the role reads «Emergencia» on signal and
 * Cerrar sesión is the danger button; that session has no account, so it has no «Mis sesiones». The rail's card sits
 * on the navy rail in both themes; the phone's row sits on the page and follows the theme.
 */
export function ProfileCard({ variant, name, roleLabel, shortRoleLabel, emergency, notice, signOut }: ProfileCardProps) {
  const rail = variant === "rail";
  const noticeId = `${variant}-session-notice`;
  const action = cn(
    "size-11",
    rail && "w-full rounded-control text-white/80 hover:bg-white/8 hover:text-white focus-visible:outline-white",
    emergency && "text-on-tint-red hover:bg-on-tint-red/12 hover:text-on-tint-red",
  );

  return (
    <section
      aria-label={emergency ? "Sesión: acceso de emergencia" : `Sesión: ${name}, ${roleLabel}`}
      aria-describedby={notice ? noticeId : undefined}
      title={notice}
      className={cn(
        rail
          ? "grid w-21 justify-items-center gap-1.5 rounded-2xl px-1 pt-3 pb-1 text-center text-white"
          : "flex items-center gap-3 rounded-card p-3",
        emergency
          ? "bg-tint-red text-on-tint-red"
          : rail
            ? "bg-deep-lift shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]"
            : "bg-card shadow-[inset_0_0_0_1px_var(--color-paper-ring)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold",
          emergency
            ? "bg-signal text-white"
            : rail
              ? "bg-deep text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)]"
              : "bg-card text-sky-bright ring-1 ring-border",
        )}
      >
        {emergency ? <Icon name="alert" className="size-5" /> : initialsOf(name)}
      </span>
      <div className={cn("grid min-w-0", rail ? "justify-items-center gap-1.5" : "flex-1 justify-items-start gap-0.5")}>
        <b className={cn("font-bold wrap-anywhere", rail ? "max-w-19 text-xs leading-tight" : "text-[0.9375rem]")}>{name}</b>
        <span
          className={cn(
            "rounded-full font-semibold whitespace-nowrap",
            rail ? "px-2 py-0.75 text-[0.6875rem] leading-none" : "px-2.5 py-0.5 text-xs leading-5",
            emergency
              ? "bg-signal text-white"
              : rail
                ? "text-white/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)]"
                : "text-mist shadow-[inset_0_0_0_1px_var(--color-border)]",
          )}
        >
          {rail ? shortRoleLabel : roleLabel}
        </span>
      </div>
      {notice ? (
        <p id={noticeId} className="sr-only">
          {notice}
        </p>
      ) : null}
      <div
        className={cn(
          rail ? "mt-1 grid w-full gap-0.5 border-t pt-1" : "flex shrink-0 items-center gap-0.5",
          rail && (emergency ? "border-on-tint-red/30" : "border-white/15"),
        )}
      >
        {emergency ? null : (
          <GuardedLink
            href="/admin/sesiones"
            aria-label="Mis sesiones"
            title="Mis sesiones"
            className={cn(
              "grid place-items-center rounded-full transition-colors duration-150 ease-out",
              rail ? action : "size-11 text-mist hover:bg-foreground/8 hover:text-foreground",
            )}
          >
            <Icon name="monitor" className="size-5" />
          </GuardedLink>
        )}
        <ThemeToggle className={rail || emergency ? action : undefined} />
        <GuardedForm action={signOut} className={rail ? "contents" : undefined}>
          <Button
            type="submit"
            variant={emergency ? "danger" : "quiet"}
            size="icon"
            title="Cerrar sesión"
            className={cn(rail && "w-full rounded-control", !emergency && rail && action, emergency && "hover:bg-signal-press")}
          >
            <Icon name="out" />
            <span className="sr-only">Cerrar sesión</span>
          </Button>
        </GuardedForm>
      </div>
    </section>
  );
}
