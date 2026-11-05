import Link from "next/link";
import { Fragment } from "react";

import { Icon } from "@/components/icons";
import { formatStamp } from "@/interface/admin/day-groups";
import { createPreviewToken } from "@/interface/admin/preview/actions";
import { getPreviewCodes, getPreviewPending, getPreviewSetup, type PreviewCodeView } from "@/interface/admin/preview/preview-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";

import { EmptyState } from "../_components/empty-state";
import { FormColumns, Panel } from "../_components/form-layout";
import { PageHeader } from "../_components/page-header";
import { SectionTitle } from "../_components/section-title";
import { Stamp } from "../_components/timeline-parts";
import { PreviewTokenForm } from "./_components/preview-token-form";

// Reads the environment and the audit log on every request.
export const dynamic = "force-dynamic";

// The empty state brings its own top margin for a page; under a heading it would double the gap.
const SECTION = "grid content-start gap-3 [&>[data-slot=empty-state]]:mt-0";
const ROW_LINK =
  "group flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors duration-150 ease-out hover:bg-foreground/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky";

type Pending = Awaited<ReturnType<typeof getPreviewPending>>;

/** What a code reveals beyond the public site: the drafts and the scheduled items, each one click from its edit page. */
function RevealedSection({ pending }: { pending: Pending }) {
  const rest = pending.draftsTotal - pending.drafts.length;

  return (
    <section aria-labelledby="revealed-title" className={SECTION}>
      <SectionTitle id="revealed-title">Lo que muestra un código</SectionTitle>
      {pending.drafts.length > 0 ? (
        <>
          <p className="text-mist">Quien tenga un código ve esto además de lo ya publicado.</p>
          <ul className="divide-y divide-border overflow-hidden rounded bg-card">
            {pending.drafts.map((draft) => (
              <li key={`${draft.kind}-${draft.id}`}>
                <Link href={draft.href} className={ROW_LINK}>
                  <Stamp className="w-20 justify-center">{draft.kind}</Stamp>
                  <span className="min-w-0 truncate">{draft.title}</span>
                  <span className="shrink-0 font-mono text-xs text-mist">{draft.scheduled ? "programado" : "borrador"}</span>
                  <Icon name="right" className="ml-auto size-4 shrink-0 text-mist transition-transform duration-200 ease-(--ease-reveal) group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </li>
            ))}
            {rest > 0 ? <li className="px-4 py-2.5 font-mono text-[0.8125rem] text-mist">y {pluralize(rest, "elemento más", "elementos más")} en sus listas</li> : null}
          </ul>
        </>
      ) : (
        <EmptyState icon="eye">No hay borradores ni contenido programado: hoy un código mostraría lo mismo que el sitio público.</EmptyState>
      )}
    </section>
  );
}

function CodeRow({ code, now }: { code: PreviewCodeView; now: Date }) {
  const active = code.expiresAt !== null && code.expiresAt.getTime() > now.getTime();

  return (
    <li className="grid gap-1 px-4 py-3">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="min-w-0 font-semibold wrap-anywhere">{code.by}</span>
        <time dateTime={code.createdAt.toISOString()} className="font-mono text-[0.8125rem] whitespace-nowrap text-mist">
          {formatStamp(code.createdAt, now)}
        </time>
      </span>
      <span className="font-mono text-[0.8125rem] text-mist">
        {code.expiresAt === null ? (
          "Vigencia no registrada"
        ) : (
          <>
            <span className={active ? "text-sky" : undefined}>{active ? "Vigente · vence" : "Venció"}</span>{" "}
            <time dateTime={code.expiresAt.toISOString()}>{formatStamp(code.expiresAt, now)}</time>
          </>
        )}
      </span>
    </li>
  );
}

/** Who generated a code and until when it works. The codes themselves are never stored, so they are not here. */
function CodesSection({ codes, scope, now }: { codes: PreviewCodeView[]; scope: "all" | "own"; now: Date }) {
  return (
    <section aria-labelledby="codes-title" className={SECTION}>
      <SectionTitle id="codes-title">Códigos generados</SectionTitle>
      {codes.length > 0 ? (
        <>
          <p className="text-mist">{scope === "all" ? "Los más recientes, de todas las personas." : "Los más recientes que usted generó."}</p>
          <ul className="divide-y divide-border overflow-hidden rounded bg-card">
            {codes.map((code) => (
              <CodeRow key={code.id} code={code} now={now} />
            ))}
          </ul>
        </>
      ) : (
        <EmptyState icon="lock">{scope === "all" ? "Todavía nadie generó un código." : "Usted todavía no generó ningún código."}</EmptyState>
      )}
      <p className="text-mist">Un código no se puede revocar desde aquí: deja de funcionar solo cuando vence. Por eso, elija la duración más corta que le alcance.</p>
    </section>
  );
}

export default async function AdminPreviewPage() {
  const now = new Date();
  const [{ configured, endpoint }, { scope, codes }, pending] = await Promise.all([getPreviewSetup(), getPreviewCodes(), getPreviewPending(now)]);

  return (
    <div>
      <PageHeader
        title="Vista previa"
        status="Borradores y contenido programado, solo con código"
        description="Genere un código para ver en una versión de prueba lo que todavía no es público. Quien lo tenga ve ese contenido hasta que venza, así que compártalo solo con quien deba revisarlo."
      />

      <FormColumns
        aside={
          // Keyed: React flags a node handed down from the page when it sits beside a sibling without one.
          <>
            <Fragment key="revealed">
              <RevealedSection pending={pending} />
            </Fragment>
            <Fragment key="codes">
              <CodesSection codes={codes} scope={scope} now={now} />
            </Fragment>
          </>
        }
      >
        <Panel aria-labelledby="preview-title">
          <SectionTitle id="preview-title" className="mb-4">
            Generar un código
          </SectionTitle>
          {configured ? (
            <PreviewTokenForm action={createPreviewToken} endpoint={endpoint} />
          ) : (
            <p role="status" className="text-mist">
              La vista previa no está configurada en este servidor. Pida a quien administra el despliegue que defina PREVIEW_TOKEN_SECRET.
            </p>
          )}
        </Panel>
      </FormColumns>
    </div>
  );
}
