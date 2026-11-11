import { Icon } from "@/components/icons";

import { GoogleButton } from "../../_components/google-button";

/**
 * What /foro shows the member the moderation suspended, in place of the sign-in: why they are out and who to write
 * to. It carries nothing of the forum and nothing about the person (not even their name), and it is shown only to
 * the holder of that member's own session cookie (`hasSuspendedForumSession`). The way in with another account stays.
 */
export function SuspensionNotice({ next }: { next?: string }) {
  return (
    // `data-bleed`: like the sign-in, it fills the width under the top bar.
    <div data-bleed>
      <section aria-labelledby="suspension-title" className="flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center gap-6 px-6 py-8 min-[900px]:px-[clamp(1.5rem,5vw,6rem)]">
        <Icon name="alert" className="size-10 text-error" />
        <h1 id="suspension-title" className="font-display text-[clamp(2rem,8vw,3.5rem)] leading-[1.05] tracking-[-0.03em] text-balance">
          Su cuenta del foro está suspendida
        </h1>
        <div className="grid max-w-[44rem] gap-3 text-[1.0625rem] leading-relaxed text-mist">
          <p>La moderación suspendió su cuenta, por eso no puede ver ni publicar en el foro.</p>
          <p>
            Si cree que es un error o quiere pedir que la reactiven, <strong className="font-semibold text-foreground">escriba a la directiva de ASO</strong>.
          </p>
        </div>
        <GoogleButton href={next ? `/foro/auth/google/start?next=${encodeURIComponent(next)}` : "/foro/auth/google/start"} className="px-6 text-center">
          Entrar con otra cuenta de Google
        </GoogleButton>
      </section>
    </div>
  );
}
