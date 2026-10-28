import { Icon, type IconName } from "@/components/icons";

// Each step is something the forum does: opening a thread, the author's best-answer mark, the moderation reports.
const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "msg", title: "Pregunte", text: "Abra un hilo en la categoría que corresponda y otros estudiantes le responden." },
  { icon: "check", title: "Marque la mejor respuesta", text: "Quien abrió el hilo la marca y el hilo pasa a Resueltos." },
  { icon: "alert", title: "Reporte lo que incumpla las reglas", text: "Reportar avisa a la moderación, que puede ocultar un mensaje o cerrar el hilo." },
];

/** A short guide to the forum for the side of the list on wide screens, and below it on phones. */
export function ForumHowItWorks() {
  return (
    <aside aria-labelledby="how-it-works-title" className="overflow-hidden rounded-xl border border-border bg-muted">
      <h2 id="how-it-works-title" className="flex items-center gap-2 border-b border-border px-3 py-3 text-base font-bold font-stretch-[106%] tracking-tight sm:px-4">
        <Icon name="terminal" className="size-4 text-sky" />
        Cómo funciona el foro
      </h2>
      <ol className="grid gap-4 px-3 py-4 sm:px-4">
        {STEPS.map(({ icon, title, text }) => (
          <li key={title} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3">
            <Icon name={icon} className="mt-0.5 size-5 text-sky" />
            <div className="grid gap-0.5">
              <strong className="font-semibold text-foreground">{title}</strong>
              <p className="text-sm text-mist">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
