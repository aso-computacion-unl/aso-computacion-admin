"use client";

import { usePathname } from "next/navigation";

import type { OwnForumAccount } from "@/application";

import { GoogleMark } from "../../_components/google-mark";
import { IdentityChip } from "../../_components/identity-chip";
import { ThemeToggle } from "../../_components/theme-toggle";
import { SignOutButton } from "../../_components/member-sign-out-button";

import { registrationListSignInHref } from "./login-problems";

const LIST_PATH = "/inscripciones";
// The member session is the forum's: a UNL account, so the menu names it as the forum does.
const MEMBER_ROLE_LABEL = "Estudiante UNL";
const SESSION_NOTICE = "Su sesión sigue abierta 30 días en este navegador. En una computadora compartida, ciérrela al terminar.";

interface RegistrationHeaderAccessProps {
  /** The signed-in member's own name and email, or null for a visitor. */
  member: OwnForumAccount | null;
  /** The Google sign-in is configured on this server: only then is it offered. */
  loginAvailable: boolean;
}

/**
 * The right side of the registrations' top bar. On the list (S1, S2) it is the optional UNL access: "Entrar" with the
 * address it takes for a visitor (the forum's Google sign-in, which comes back to the list), or the member's account
 * menu with the sign-out, which leaves them on the list. Nothing here is required: the open events need no account.
 * An event's page keeps only the theme toggle, because the page itself owns the sign-in and the reservation.
 */
export function RegistrationHeaderAccess({ member, loginAvailable }: RegistrationHeaderAccessProps) {
  const onList = usePathname() === LIST_PATH;

  if (onList && member) {
    return <IdentityChip name={member.name} email={member.email} roleLabel={MEMBER_ROLE_LABEL} notice={SESSION_NOTICE} signOut={<SignOutButton returnTo={LIST_PATH} />} />;
  }

  return (
    <>
      {onList && loginAvailable ? (
        // A plain link, not next/link: it starts a redirect flow and must not be prefetched.
        <a href={registrationListSignInHref()} className="reg-enter">
          <GoogleMark className="reg-enter-mark" />
          Entrar{" "}
          <small className="reg-enter-domain">@unl.edu.ec</small>
        </a>
      ) : null}
      <ThemeToggle />
    </>
  );
}
